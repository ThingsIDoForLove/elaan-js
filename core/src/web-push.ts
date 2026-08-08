// Browser push: permission, service worker, subscribe, register.
//
// Its own entry point (`@elaanio/core/web-push`) rather than part of the main one,
// because `@elaanio/react-native` imports core and must never evaluate a module
// that reaches for `navigator.serviceWorker`.
//
// What this owns is the awkward middle of the Web Push handshake. A destination is
// an endpoint *plus* two client keys, the keys arrive as raw ArrayBuffers, the
// application server key goes the other way as bytes, and every one of those
// conversions fails silently when it is wrong (see `base64url.ts`). The rest —
// what to do when permission is denied, what happens on a key rotation — is the
// part every consumer would otherwise re-derive from the spec.

import type { ElaanClient } from "./client";
import { base64UrlToBytes, bytesToBase64Url } from "./base64url";

/** Why a subscribe attempt didn't produce a subscription.
 *
 * A discriminated result rather than a thrown error, because none of these are
 * exceptional: they are the ordinary states a UI has to render. Only genuinely
 * unexpected failures (the API being down) throw.
 */
export type BrowserPushFailure =
  /** No service worker or no Push API — an old browser, or a non-secure origin. */
  | { ok: false; reason: "unsupported" }
  /** The user said no, or had already said no. Not recoverable in code: the
   *  browser will not re-prompt, so the app has to tell them to change it in
   *  site settings. */
  | { ok: false; reason: "denied" }
  /** The user dismissed the prompt without choosing. Asking again later is fine. */
  | { ok: false; reason: "dismissed" }
  /** The account has no Web Push transport, so nobody can subscribe to it yet. */
  | { ok: false; reason: "not-configured" };

export type BrowserPushResult =
  | { ok: true; endpoint: string; renewed: boolean }
  | BrowserPushFailure;

export interface BrowserPushOptions {
  client: ElaanClient;
  /** URL of *your* service worker. It must handle the `push` event — see
   *  `@elaanio/core/service-worker`. Registered with this call rather than
   *  assumed, because most apps already have one and a second registration at a
   *  different scope silently competes with the first. */
  serviceWorkerUrl: string;
  /** Scope for the registration. Defaults to the worker's own directory, which is
   *  the browser's default and why the file usually needs to sit at the origin
   *  root to cover the whole app. */
  scope?: string;
}

/** Whether this browser can do push at all.
 *
 * Both halves are needed and they are separate: a browser can have service
 * workers without the Push API. Also false on an insecure origin, where
 * `serviceWorker` is simply absent — which is why `localhost` works and a plain
 * `http://` staging host does not.
 */
export function browserPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The current permission, without prompting. `"denied"` is terminal in code. */
export function browserPushPermission(): NotificationPermission | "unsupported" {
  if (!browserPushSupported()) return "unsupported";
  return Notification.permission;
}

/** The endpoint this browser is currently subscribed with, or null.
 *
 * Reads the *browser's* view, not the server's: the two can disagree (a user can
 * revoke permission in site settings, and the push service can expire an endpoint)
 * and the browser is the authority on whether a push can still arrive here.
 */
export async function currentBrowserSubscription(
  serviceWorkerUrl?: string,
): Promise<PushSubscription | null> {
  if (!browserPushSupported()) return null;
  const registration = serviceWorkerUrl
    ? await navigator.serviceWorker.register(serviceWorkerUrl)
    : await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Subscribe this browser and register the destination with Elaan.
 *
 * Safe to call on every page load for a subscribed user: an existing subscription
 * against the current key is re-registered rather than replaced, which is how the
 * server learns about a subscription made on a device it has since forgotten.
 */
export async function subscribeToBrowserPush(
  options: BrowserPushOptions,
): Promise<BrowserPushResult> {
  const { client, serviceWorkerUrl, scope } = options;
  if (!browserPushSupported()) return { ok: false, reason: "unsupported" };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };

  // Before prompting: no point asking for permission the account cannot use, and
  // a permission prompt the user grants for nothing is spent — the browser will
  // not ask again.
  let applicationServerKey: string;
  try {
    applicationServerKey = await client.getWebPushPublicKey();
  } catch (error) {
    if ((error as { status?: number })?.status === 404) {
      return { ok: false, reason: "not-configured" };
    }
    throw error;
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  // "default" means the prompt was dismissed rather than answered. Distinct from
  // denial: it is worth asking again on a later, better-timed interaction.
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  const registration = await navigator.serviceWorker.register(
    serviceWorkerUrl,
    scope ? { scope } : undefined,
  );
  // `register` resolves before the worker is active, and subscribing through a
  // registration whose worker is still installing throws in some browsers.
  await navigator.serviceWorker.ready;

  const keyBytes = base64UrlToBytes(applicationServerKey);
  let subscription = await registration.pushManager.getSubscription();
  let renewed = false;

  if (subscription && !subscribedWithKey(subscription, keyBytes)) {
    // The account rotated its VAPID pair. This subscription can never be
    // delivered to again — the push service checks the signature against the key
    // it was created with — so replace it rather than re-registering a dead
    // endpoint. Unsubscribing first also frees the old endpoint server-side when
    // the new one lands under a different value.
    await subscription.unsubscribe();
    subscription = null;
    renewed = true;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      // Required. A browser will not grant a subscription without it, and it is
      // also why a web push template must carry a title: we have promised the
      // user something visible will appear.
      userVisibleOnly: true,
      applicationServerKey: keyBytes as BufferSource,
    });
  }

  await client.addPushSubscription(subscription.endpoint, "webpush", "web", {
    auth: bytesToBase64Url(subscription.getKey("auth")),
    p256dh: bytesToBase64Url(subscription.getKey("p256dh")),
  });

  return { ok: true, endpoint: subscription.endpoint, renewed };
}

/**
 * Stop this browser receiving, and tell Elaan.
 *
 * Both halves, in that order. Dropping only the local subscription leaves a row
 * the server keeps sending to until the push service 410s it; dropping only the
 * server row leaves a browser that still shows notifications the next time
 * anything re-registers it.
 */
export async function unsubscribeFromBrowserPush(options: {
  client: ElaanClient;
  serviceWorkerUrl?: string;
}): Promise<boolean> {
  const subscription = await currentBrowserSubscription(options.serviceWorkerUrl);
  if (!subscription) return false;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await options.client.removePushSubscription(endpoint, "webpush");
  return true;
}

/** Whether a subscription was created against this application server key.
 *
 * `options.applicationServerKey` is the raw key the subscription carries; a
 * mismatch means the account's VAPID pair changed since it was made, and nothing
 * can be delivered to it any more.
 */
function subscribedWithKey(
  subscription: PushSubscription,
  keyBytes: Uint8Array,
): boolean {
  const existing = subscription.options?.applicationServerKey;
  // Absent in browsers that don't expose `options`. Treated as a match rather
  // than a rotation: needlessly unsubscribing a working browser costs the user
  // their notifications, while a missed rotation is repaired by the next send
  // failing and pruning the endpoint.
  if (!existing) return true;
  const a = new Uint8Array(existing as ArrayBuffer);
  if (a.length !== keyBytes.length) return false;
  return a.every((byte, i) => byte === keyBytes[i]);
}
