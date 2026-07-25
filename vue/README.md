# @elaanio/vue

Drop-in Vue 3 components + composables for [Elaan](https://elaan.io): an in-app
notification inbox, a notification bell, a preferences center, and push
device-token registration — backed by your Elaan account.

```bash
npm install @elaanio/vue
```

Peer dependency: `vue` >= 3.3. Same feature set as
[`@elaanio/react`](https://www.npmjs.com/package/@elaanio/react); realtime uses
SSE in the browser with automatic polling fallback.

## 1. Mint a contact token on your backend

The SDK never sees your API key. Your backend mints a short-lived **contact
token** for the signed-in user (`POST /v1/contacts/tokens` with your service key,
by `external_id`) and returns it to the browser.

## 2. Wrap your app in the provider

```vue
<script setup lang="ts">
import { ElaanProvider } from "@elaanio/vue";
import "@elaanio/vue/styles.css";

async function tokenProvider() {
  const res = await fetch("/api/elaan-token"); // your endpoint
  const { token, contact_id } = await res.json();
  return { token, contactId: contact_id };
}
</script>

<template>
  <ElaanProvider apiBase="https://api.elaan.io/v1" :tokenProvider="tokenProvider">
    <App />
  </ElaanProvider>
</template>
```

The SDK refreshes the token automatically on expiry. Pass `:realtime="null"` to
force polling, or `:pollInterval="ms"` to tune it.

## 3. Use the components

```vue
<script setup lang="ts">
import { NotificationBell, NotificationFeed, Preferences } from "@elaanio/vue";
</script>

<template>
  <!-- A bell with an unread badge + popover inbox — drop it in your header. -->
  <NotificationBell />

  <!-- Or the inbox feed inline. -->
  <NotificationFeed empty-text="Nothing here yet." />

  <!-- A preferences center: a toggle per notification type × channel. -->
  <Preferences />
</template>
```

### Push device tokens

```ts
import { usePush } from "@elaanio/vue";

const { register, unregister } = usePush();
// provider: "fcm" | "apns" | "expo" | "onesignal" | "webpush"
await register(fcmToken, "fcm", "web");
```

## Headless — bring your own UI

Every component is built on composables you can use directly (they return Vue
refs, so they're reactive in templates):

```ts
import { useNotifications, usePreferences } from "@elaanio/vue";

const { notifications, unreadCount, connected, markRead, markAllRead, remove } =
  useNotifications();

const { preferences, setPreference, clearPreference } = usePreferences();
```

Available composables: `useNotifications`, `useUnreadCount`, `usePreferences`,
`usePush` — all must be called under an `<ElaanProvider>`.

## Theming

Override the CSS variables on `:root` (or any ancestor). The default theme adapts
to light/dark via `prefers-color-scheme`; see the
[repo README](https://github.com/ThingsIDoForLove/elaan-js#theming--styling) for
the full variable list.

```css
:root {
  --elaan-accent: #7c3aed;
  --elaan-radius: 6px;
}
```

## License

MIT
