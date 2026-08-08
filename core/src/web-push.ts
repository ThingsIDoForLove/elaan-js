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

import { ElaanError, type ElaanClient } from "./client";
import { base64UrlToBytes, bytesToBase64Url } from "./base64url";

// The account's VAPID key, memoised per client.
//
// It is per-account and effectively immutable — rotating it invalidates every
// existing subscription, so it is never a casual operation — and `subscribe()`
// must not spend a click's user activation waiting for it. A WeakMap so a
// discarded client doesn't pin the entry.
const keyCache = new WeakMap<ElaanClient, Promise<string>>();

function getWebPushKey(client: ElaanClient): Promise<string> {
  const cached = keyCache.get(client);
  if (cached) return cached;
  const pending = client.getWebPushPublicKey().catch((error: unknown) => {
    // Don't cache a failure: "not configured yet" becomes "configured" the moment
    // the tenant adds VAPID keys, and a poisoned cache would outlive that.
    keyCache.delete(client);
    throw error;
  });
  keyCache.set(client, pending);
  return pending;
}

/** Warm the VAPID key cache.
 *
 * Optional but worth calling at idle — say when you first render a
 * notifications toggle. `subscribeToBrowserPush` has to prompt before it can
 * fetch anything (the prompt needs the click's user activation), so without this
 * the key fetch lands between the user's "Allow" and the subscription. */
export async function prefetchWebPushKey(client: ElaanClient): Promise<void> {
  await getWebPushKey(client).catch(() => {
    /* a warm-up must never be the thing that fails a page */
  });
}

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
  scope?: string,
): Promise<PushSubscription | null> {
  if (!browserPushSupported()) return null;
  // Pass `serviceWorkerUrl` whenever you have it. The fallback resolves a
  // registration by matching the *page* URL against registered scopes, which is
  // wrong in both directions: a worker at /static/sw.js is invisible from /settings
  // (so a subscribed browser reads as unsubscribed), and a host app's own
  // root-scoped worker is returned instead (so another vendor's subscription is
  // reported as ours — and unsubscribing would destroy theirs).
  const registration = serviceWorkerUrl
    ? await navigator.serviceWorker.register(
        serviceWorkerUrl,
        scope ? { scope } : undefined,
      )
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

  // Prompt FIRST, before any network round-trip.
  //
  // The tempting order is to fetch the key first, so a permission the user grants
  // for an account that cannot send isn't spent. But `requestPermission()` needs
  // the click's transient user activation, and Firefox and WebKit refuse without
  // it — so awaiting a token mint plus a GET first means that on a slow connection
  // the prompt either never appears or throws, and the caller is told the user
  // dismissed a prompt they were never shown. A timing-dependent failure that
  // passes against localhost every time.
  //
  // The wasted-prompt case is handled instead by `prefetchWebPushKey`, which a
  // caller can await at idle so the key is already cached when the click arrives.
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  // "default" means the prompt was dismissed rather than answered. Distinct from
  // denial: it is worth asking again on a later, better-timed interaction.
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  let applicationServerKey: string;
  try {
    applicationServerKey = await getWebPushKey(client);
  } catch (error) {
    // `status` is `ElaanError`'s, so check the type rather than duck-typing: a
    // host `tokenProvider` that throws a 404 `Response` would otherwise be
    // misreported as "this account has no Web Push transport".
    if (error instanceof ElaanError && error.status === 404) {
      return { ok: false, reason: "not-configured" };
    }
    throw error;
  }

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
    // The account rotated its VAPID pair. This subscription can never be delivered
    // to again — the push service checks the signature against the key it was
    // created with — so replace it rather than re-registering a dead endpoint.
    //
    // The server row must be removed explicitly. The new subscription arrives under
    // a *different* endpoint, and a row is keyed by (provider, endpoint) — the
    // server replaces only on an identity match — so without this the contact ends
    // up holding two webpush destinations and every send enqueues one per row. The
    // dead one is reaped only after a send fails 404/410, and a key mismatch is a
    // 403, which is retryable-then-dead-lettered and never prunes anything.
    const dead = subscription.endpoint;
    await subscription.unsubscribe();
    await client.removePushSubscription(dead, "webpush").catch(() => {
      // Best effort: a stale extra row is worse than nothing but much better than
      // failing a subscribe the user asked for. It will be pruned on its first
      // 404/410 if the push service ever forgets it.
    });
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
  rememberEndpoint(client, subscription.endpoint);

  return { ok: true, endpoint: subscription.endpoint, renewed };
}

/**
 * Stop this browser receiving, and tell Elaan.
 *
 * Returns whether anything was removed — false only when there was nothing on
 * either side. Callers should surface that rather than assume success: reporting
 * "off" while a live subscription survives is the one outcome the user would call
 * a lie.
 *
 * **The API call comes first, deliberately.** Unsubscribing locally first destroys
 * the endpoint string, so if the DELETE then fails (offline, an expired token, a
 * 5xx) a retry has nothing left to name and the server row becomes unremovable by
 * any code path — while the tenant keeps enqueueing a send per delivery to it. The
 * DELETE is idempotent, so doing it first costs nothing.
 */
export async function unsubscribeFromBrowserPush(options: {
  client: ElaanClient;
  serviceWorkerUrl?: string;
  scope?: string;
}): Promise<boolean> {
  const subscription = await currentBrowserSubscription(
    options.serviceWorkerUrl,
    options.scope,
  );
  // No local subscription is NOT nothing to do. Blocking notifications in site
  // settings, or clearing site data, drops the browser's PushSubscription while the
  // server row lives on — so returning early here left the "turn it off" button
  // permanently inert and the tenant enqueueing a send per delivery to a dead
  // endpoint. Fall back to the endpoint we recorded when we registered it; there is
  // no contact-facing read that would let us ask the server what it holds.
  const endpoint = subscription?.endpoint ?? rememberedEndpoint(options.client);
  if (!endpoint) return false;

  await options.client.removePushSubscription(endpoint, "webpush");
  // Local teardown second: doing it first destroys the only copy of the endpoint,
  // so a failed DELETE would leave a row nothing can ever name again.
  if (subscription) await subscription.unsubscribe();
  forgetEndpoint(options.client);
  return true;
}

// The endpoint this browser last registered, so `unsubscribe` still has something
// to name after the browser has dropped the subscription itself. Keyed by contact,
// because one browser can be signed in as different contacts over time.
const STORAGE_PREFIX = "elaan.webpush.endpoint.";

function storageKey(client: ElaanClient): string | null {
  const id = client.contactId;
  return id ? STORAGE_PREFIX + id : null;
}

function rememberEndpoint(client: ElaanClient, endpoint: string): void {
  const key = storageKey(client);
  if (!key) return;
  try {
    localStorage.setItem(key, endpoint);
  } catch {
    // Private mode, or storage full. Losing the fallback is a degraded unsubscribe,
    // never a failed subscribe.
  }
}

function rememberedEndpoint(client: ElaanClient): string | null {
  const key = storageKey(client);
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function forgetEndpoint(client: ElaanClient): void {
  const key = storageKey(client);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* see rememberEndpoint */
  }
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
  // Absent in browsers that don't expose `options`. Treated as a match, because
  // the alternative — unsubscribing on every call — would churn a working
  // subscription on every page load.
  //
  // Be clear about the cost, since it is NOT self-healing: a key mismatch makes
  // the push service answer 403, and the server prunes a destination only on
  // 404/410, so a missed rotation dead-letters five sends and then sits there
  // silently receiving nothing. Every browser that ships Push also exposes
  // `options` (it has been in the spec since 2016), so this is a floor for
  // something exotic rather than a case in the field — but a rotation is the one
  // operation that would expose it, which is another reason rotating is not casual.
  if (!existing) return true;
  const a = new Uint8Array(existing as ArrayBuffer);
  if (a.length !== keyBytes.length) return false;
  return a.every((byte, i) => byte === keyBytes[i]);
}
