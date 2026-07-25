# @elaanio/react-native

Drop-in **React Native** components + hooks for [Elaan](https://elaan.io): an
in-app notification inbox, a bell with an unread badge, a preferences center, and
push device-token registration — backed by your Elaan account.

```bash
npm install @elaanio/react-native
```

Peer dependencies: `react` and `react-native`. Same API as
[`@elaanio/react`](https://www.npmjs.com/package/@elaanio/react); the components
render with RN primitives (`View`/`FlatList`/`Switch`/`Modal`) and there's no
stylesheet to import.

## 1. Mint a contact token on your backend

The SDK never sees your API key. Your backend mints a short-lived **contact
token** for the signed-in user (`POST /v1/contacts/tokens` with your service key,
by `external_id`) and returns it to the app.

## 2. Wrap your app in the provider

```tsx
import { ElaanProvider } from "@elaanio/react-native";

async function tokenProvider() {
  const res = await fetch("https://yourapp.com/api/elaan-token", {
    headers: { Authorization: `Bearer ${yourSessionToken}` },
  });
  const { token, contact_id } = await res.json();
  return { token, contactId: contact_id };
}

export default function App() {
  return (
    <ElaanProvider apiBase="https://api.elaan.io/v1" tokenProvider={tokenProvider}>
      <RootNavigator />
    </ElaanProvider>
  );
}
```

The SDK refreshes the token automatically on expiry.

### Realtime

The RN provider streams live updates over **SSE**, backed by
[`react-native-sse`](https://www.npmjs.com/package/react-native-sse) (a runtime
dependency). React Native can't stream a `fetch` body like the browser, but
`react-native-sse`'s XHR-based EventSource can — and, unlike the browser's native
`EventSource`, it sends the `Authorization` header the contact token needs. It's
wired in by default and **falls back to polling** (default every 30s) when the
deployment has realtime off or a connection can't be held. Tune the poll with
`pollInterval={ms}`, or pass `realtime={null}` to disable SSE entirely.

> **Backgrounding & SaaS notes.** A held SSE connection only survives while the
> app is foregrounded — pair it with push notifications for background delivery
> (the store refetches over REST on reconnect/foreground, so nothing is lost).
> The SSE endpoint is also currently on-prem/ALB only; on API-Gateway SaaS the
> transport gets a 404/503 and cleanly falls back to polling.

## 3. Use the components

```tsx
import {
  NotificationBell,
  NotificationFeed,
  Preferences,
} from "@elaanio/react-native";

// Bell + badge that opens the inbox in a modal card — drop in a header.
<NotificationBell onNotificationPress={(n) => navigate(n)} />

// …or the inbox inline as a full screen.
<NotificationFeed
  emptyText="Nothing here yet."
  onNotificationPress={(n) => navigate(n)}
/>

// A preferences screen: a Switch per notification type × channel.
<Preferences typeLabel={(key) => LABELS[key] ?? key} />
```

### Push device tokens

```tsx
import { usePush } from "@elaanio/react-native";

const { register, unregister } = usePush();
// provider: "expo" | "fcm" | "apns" | "onesignal" | "webpush"
await register(expoPushToken, "expo", "ios"); // platform: "ios" | "android" | "web"
```

## Theming & custom UI

The components use `StyleSheet` with a small built-in palette (accent,
background, text, muted, border) that works on light backgrounds. There are no
CSS variables in React Native, so for brand fonts, custom row layouts, or a
dark-mode palette, **build your own components on the hooks** — that's the
intended path for heavy customization:

```tsx
import { useNotifications, usePreferences, useUnreadCount } from "@elaanio/react-native";

function MyInbox() {
  const { notifications, loading, markRead, markAllRead, remove } =
    useNotifications();
  // render your own <FlatList>/rows; the hook owns loading, polling, and
  // optimistic updates.
}
```

The hooks are re-exported from
[`@elaanio/react-core`](https://www.npmjs.com/package/@elaanio/react-core); see the
[repo README](https://github.com/ThingsIDoForLove/elaan-js#building-your-own-components)
for the full "build your own" guide.

## License

MIT
