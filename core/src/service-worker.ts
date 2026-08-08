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
}
interface WorkerScope {
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

/** Keys Elaan reserves inside `data` for the notification's own options.
 *
 * The delivery outbox is channel-agnostic — a rendered title, body and a flat
 * `data` map serves Expo, FCM and Web Push alike — so a web push's icon, badge and
 * click-through URL travel inside `data` under these names rather than as three
 * columns only one channel would populate. The server refuses them as tenant keys
 * (`RESERVED_DATA_KEYS`), so a collision is not possible.
 *
 * Mirrors `outbound_push/core/domain/web_push_options.py`. The prefix is `_`,
 * which no template author writes by accident.
 */
const ICON = "_icon";
const BADGE = "_badge";
const URL_KEY = "_url";

export interface ElaanPushPayload {
  title: string;
  body?: string;
  data?: Record<string, string>;
}

/** The notification a payload describes, split from the tenant's own data.
 *
 * Exported so a worker that wants to do something else — badge the tab, post to
 * a client, coalesce with an existing notification — can reuse the unpacking
 * without reimplementing the reserved-key contract.
 */
export function unpackPush(payload: ElaanPushPayload): {
  title: string;
  options: NotificationOptions;
  url: string | null;
} {
  const data = payload.data ?? {};
  const url = data[URL_KEY] || null;
  const tenantData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== ICON && key !== BADGE && key !== URL_KEY) tenantData[key] = value;
  }
  return {
    // A title is guaranteed by the server (a web push template cannot be saved
    // without one), so the fallback is for a hand-rolled sender, not for us.
    title: payload.title || "Notification",
    options: {
      body: payload.body || "",
      icon: data[ICON] || undefined,
      badge: data[BADGE] || undefined,
      // The click handler needs the URL, and `data` is the only thing that
      // survives to the `notificationclick` event.
      data: { ...tenantData, ...(url ? { [URL_KEY]: url } : {}) },
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
  const target = data[URL_KEY];
  if (!target) return;

  event.waitUntil(
    (async () => {
      const clientList = await scope.clients.matchAll({
        type: "window",
        // Needed to see tabs this worker did not itself open, which is most of
        // them.
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        // `client.focus` rather than `"focus" in client`: the `in` form doesn't
        // narrow an optional method, and focus is genuinely absent on non-window
        // clients.
        if (client.url === target && client.focus) {
          await client.focus();
          return;
        }
      }
      await scope.clients.openWindow(target);
    })(),
  );
}
