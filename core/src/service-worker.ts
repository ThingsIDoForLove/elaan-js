// The service-worker half of browser push: turning a delivered payload into a
// visible notification.
//
// Imported by *your* service worker, not registered by us — most apps already
// have one, and two registrations at different scopes silently compete. Two
// one-liners is the whole integration:
//
//   import { handlePush, handleNotificationClick } from "@elaanio/core/service-worker";
//   self.addEventListener("push", handlePush);
//   self.addEventListener("notificationclick", handleNotificationClick);
//
// Kept here rather than left to a docs snippet because the payload shape is ours,
// and a worker that shows nothing is worse than one that errors: the browser
// substitutes its own "This site has been updated in the background" notice, in
// copy nobody chose.

// Minimal structural types for the worker globals this module touches.
//
// Declared here rather than pulling in `@types/serviceworker` or adding the
// `webworker` lib: this package compiles as ONE program with `lib: ["DOM"]`
// (web-push.ts needs it), and both of those redeclare globals the DOM lib already
// defines, so either one turns a working build into a wall of duplicate-identifier
// errors. Structural and narrow, so it describes exactly the surface used below
// and nothing a reader has to check against the spec.

interface PushMessageData {
  json(): unknown;
}
interface PushEventLike {
  readonly data: PushMessageData | null;
  waitUntil(promise: Promise<unknown>): void;
}
interface NotificationLike {
  readonly data: unknown;
  close(): void;
}
interface NotificationEventLike {
  readonly notification: NotificationLike;
  waitUntil(promise: Promise<unknown>): void;
}
interface WindowClientLike {
  readonly url: string;
  focus?(): Promise<unknown>;
  /** Optional: absent on non-window clients, and on a client this worker does not
   *  control. Callers must fall back to `openWindow`. */
  navigate?(url: string): Promise<unknown>;
}
interface WorkerScope {
  readonly location: { href: string };
  registration: {
    showNotification(title: string, options?: NotificationOptions): Promise<void>;
  };
  clients: {
    matchAll(options?: {
      type?: string;
      includeUncontrolled?: boolean;
    }): Promise<WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
}

/** Where the click-through URL is stashed for the `notificationclick` event.
 *
 * Ours, not the server's: `event.notification.data` is the only thing that
 * survives from showing a notification to a click on it, so the URL has to ride
 * inside it. Underscore-prefixed to stay clear of the tenant's own data keys.
 */
const URL_KEY = "_url";

/** The JSON body the server transmits.
 *
 * Every field is optional because the sender omits what rendered empty. Note the
 * shape: `icon`/`badge`/`url` are at the **top level**, and `data` holds only the
 * tenant's own keys.
 *
 * That is worth stating because there is a second, similar-looking encoding that
 * is NOT this one. Inside the delivery outbox those three options travel *inside*
 * `data` under `_icon`/`_badge`/`_url`, because the outbox row is channel-agnostic
 * and adding three columns only one channel populates was not worth it. The sender
 * unpacks them back out before transmitting (`unpack_options` →
 * `message = dict(options)` in `web_push_sender.py`), so a worker reading the
 * storage form finds nothing: no icon, no badge, and every click a no-op.
 */
export interface ElaanPushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, string>;
}

/** The notification a payload describes, plus where a click should go.
 *
 * Exported so a worker that wants to do something else — badge the tab, post to a
 * client, coalesce with an existing notification — can reuse the unpacking rather
 * than re-deriving the wire shape.
 */
export function unpackPush(payload: ElaanPushPayload): {
  title: string;
  options: NotificationOptions;
  url: string | null;
} {
  const url = payload.url || null;
  return {
    // The server refuses to send a web push whose title rendered empty, so the
    // fallback is for a hand-rolled sender rather than for us — but a worker that
    // shows nothing gets the browser's own "updated in the background" notice, so
    // there has to be one.
    title: payload.title || "Notification",
    options: {
      body: payload.body || "",
      icon: payload.icon || undefined,
      badge: payload.badge || undefined,
      // The tenant's data, plus the URL under a key of ours so the click handler
      // can find it.
      data: { ...(payload.data ?? {}), ...(url ? { [URL_KEY]: url } : {}) },
    },
    url,
  };
}

/**
 * `push` handler. Always shows something.
 *
 * `event.waitUntil` is not optional: without it the worker may be killed before
 * `showNotification` resolves, and the browser then reports that the site was
 * updated in the background instead.
 */
export function handlePush(event: PushEventLike): void {
  const scope = self as unknown as WorkerScope;
  let payload: ElaanPushPayload;
  try {
    payload = (event.data?.json() ?? { title: "Notification" }) as ElaanPushPayload;
  } catch {
    // Undecodable or non-JSON. Still show something: a push arrived, and the
    // alternative is the browser's own notice.
    payload = { title: "Notification" };
  }
  const { title, options } = unpackPush(payload);
  event.waitUntil(scope.registration.showNotification(title, options));
}

/**
 * `notificationclick` handler: focus an existing tab on the target URL, or open
 * one.
 *
 * Focusing beats opening because a user with the app already open does not want a
 * second copy of it, and `clients.openWindow` would give them one.
 */
export function handleNotificationClick(event: NotificationEventLike): void {
  const scope = self as unknown as WorkerScope;
  event.notification.close();
  const data = (event.notification.data ?? {}) as Record<string, string>;
  const raw = data[URL_KEY];
  if (!raw) return;

  // Resolved against the worker's own origin, because the template's `url` is
  // free-form text the server does not require to be absolute. A relative
  // `/orders/7` would otherwise never equal a WindowClient's absolute url, so
  // every click opened a duplicate tab — and `openWindow` would resolve it
  // against the *worker scope*, landing on the wrong path for a nested scope.
  const target = new URL(raw, scope.location.href).href;

  event.waitUntil(
    (async () => {
      const clientList = await scope.clients.matchAll({
        type: "window",
        // Needed to see tabs this worker did not itself open, which is most of
        // them.
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        // Compare resolved hrefs, so `https://app.test` matches an open tab at
        // `https://app.test/`. `client.focus` rather than `"focus" in client`:
        // the `in` form doesn't narrow an optional method.
        if (new URL(client.url).href === target && client.focus) {
          await client.focus();
          // Focus alone would leave a tab sitting on /dashboard on /dashboard,
          // dropping the notification's destination. Navigate when it isn't
          // already there — and note `navigate` is optional, so fall through to
          // openWindow rather than assuming it.
          return;
        }
      }
      // Same-origin tab on a different path: reuse it rather than opening a
      // duplicate, when the browser lets us.
      for (const client of clientList) {
        if (client.navigate && new URL(client.url).origin === new URL(target).origin) {
          const navigated = await client.navigate(target);
          if (navigated && client.focus) await client.focus();
          if (navigated) return;
        }
      }
      await scope.clients.openWindow(target);
    })(),
  );
}
