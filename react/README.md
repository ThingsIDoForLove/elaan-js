# @elaanio/react

Drop-in React components + hooks for [Elaan](https://elaan.io): an in-app
notification inbox, a notification bell, a preferences center, and push
device-token registration — all backed by your Elaan account.

**Documentation:** [elaan.io/docs/react.html](https://elaan.io/docs/react.html)

```bash
npm install @elaanio/react
```

## 1. Mint a contact token on your backend

The SDK never sees your API key. Your backend mints a short-lived **contact
token** for the signed-in user and returns it to the browser:

```http
POST https://api.elaan.io/v1/contacts/tokens
Authorization: Bearer sk_your_service_key
Content-Type: application/json

{ "external_id": "your-user-id-123" }
```

```json
{ "token": "eyJ…", "contact_id": "01J…", "expires_in": 900 }
```

Expose that behind your own endpoint (e.g. `GET /api/elaan-token`).

## 2. Wrap your app in the provider

Pass a `tokenProvider` that fetches a fresh token from your endpoint. The SDK
refreshes it automatically on expiry.

```tsx
import { ElaanProvider } from "@elaanio/react";
import "@elaanio/react/styles.css";

async function tokenProvider() {
  const res = await fetch("/api/elaan-token");
  const { token, contact_id } = await res.json();
  return { token, contactId: contact_id };
}

export function App() {
  return (
    <ElaanProvider apiBase="https://api.elaan.io/v1" tokenProvider={tokenProvider}>
      <YourApp />
    </ElaanProvider>
  );
}
```

## 3. Use the components

```tsx
import { NotificationBell, NotificationFeed, Preferences } from "@elaanio/react";

// A bell with an unread badge + popover inbox — drop it in your header.
<NotificationBell />

// Or the inbox feed inline (a full-page notifications view).
<NotificationFeed />

// A preferences center: a toggle per notification type × channel.
<Preferences />
```

### Push device tokens

```tsx
import { usePush } from "@elaanio/react";

const { register, unregister } = usePush();
await register(fcmToken, "fcm", "web"); // provider: fcm | apns | expo | onesignal
```

## Realtime

Notifications update in real time over SSE when your Elaan deployment has it
enabled; otherwise the inbox polls (default every 30s). Nothing to configure —
pass `realtime={false}` to force polling, or `pollInterval={ms}` to tune it.

## Headless — bring your own UI

Every component is built on hooks you can use directly:

```tsx
import { useNotifications, usePreferences } from "@elaanio/react";

const { notifications, unreadCount, connected, markRead, markAllRead, remove } =
  useNotifications();

const { preferences, setPreference, clearPreference } = usePreferences();
```

## Theming

Override the CSS variables on `:root` (or any ancestor):

```css
:root {
  --elaan-accent: #7c3aed;
  --elaan-radius: 6px;
}
```

Tokens: `--elaan-accent`, `--elaan-accent-ink`, `--elaan-bg`,
`--elaan-bg-hover`, `--elaan-text`, `--elaan-muted`, `--elaan-border`,
`--elaan-danger`, `--elaan-radius`, `--elaan-shadow`, `--elaan-font`,
`--elaan-z`.

`--elaan-font` is unset by default, so the components inherit your app's
type stack. Name a stack in it to pin one instead. Note that setting it to
`inherit` does not do what it looks like: a CSS-wide keyword in a custom
property declaration applies to the variable, so it would just take the
parent's `--elaan-font`.

Every component takes `className` and any other DOM attribute on its root
element, so you can scope those variables to a subtree rather than `:root`:

```tsx
<NotificationBell className={styles.scope} />
```

Dark mode follows `prefers-color-scheme` by default, and a `dark` class or
`data-theme="dark"` on any ancestor switches it too, so an app with its own
theme toggle drives the components without redeclaring the palette.

The stylesheet is wrapped in `@layer elaan`, so your own unlayered rules beat
it without needing higher specificity.

## Browser push

`useBrowserPush` owns the whole browser handshake — permission, service worker,
`subscribe()`, and the key conversions — because unlike a device token there is
nothing for you to pass in.

```tsx
import { useBrowserPush } from "@elaanio/react";

const push = useBrowserPush({ serviceWorkerUrl: "/sw.js" });
const result = await push.subscribe(); // {ok} | {ok:false, reason}
```

`subscribe()` resolves to a result rather than throwing: `unsupported`, `denied`,
`dismissed` and `not-configured` are states to render, not errors. `denied` is
terminal — the browser will not prompt again.

Your service worker must show the notification, or the browser substitutes its own
"site has been updated in the background" notice:

```js
import { handlePush, handleNotificationClick } from "@elaanio/core/service-worker";
self.addEventListener("push", handlePush);
self.addEventListener("notificationclick", handleNotificationClick);
```

Full walkthrough and a runnable demo in the
[root README](../README.md#browser-push-the-web_push-channel).
