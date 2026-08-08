// The demo's service worker — and the whole integration an app has to write.
//
// Two listeners. `handlePush` shows the notification (it must: a worker that
// receives a push without showing one gets the browser's own "site has been
// updated in the background" notice instead), and `handleNotificationClick`
// focuses or opens the template's click-through URL.
//
// This file is *bundled* to `public/sw.js` before dev/build, because a classic
// service worker cannot use `import`. The alternative — registering with
// `{ type: "module" }` — works in Chrome and not in Firefox, and Firefox is a
// second real push service worth testing against.

/// <reference lib="webworker" />
import {
  handleNotificationClick,
  handlePush,
} from "@elaanio/core/service-worker";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", handlePush);
self.addEventListener("notificationclick", handleNotificationClick);

// Take over without waiting for every existing tab to close. Fine for a demo and
// usually what you want for notifications; think twice in an app whose old tabs
// depend on the previous worker's behaviour.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
