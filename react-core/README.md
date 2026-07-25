# @elaan/react-core

The **React binding** for [Elaan](https://elaan.io) — a provider and hooks over
the [`@elaan/core`](https://www.npmjs.com/package/@elaan/core) stores. Pure React,
**no DOM and no React Native primitives**, so it's shared by both the web and
native component packages.

```bash
npm install @elaan/react-core
```

Most apps don't install this directly — install the package for your platform,
which re-exports everything here:

- **Web** → [`@elaan/react`](https://www.npmjs.com/package/@elaan/react) (adds DOM components + fetch-SSE realtime)
- **React Native** → [`@elaan/react-native`](https://www.npmjs.com/package/@elaan/react-native) (adds RN components)

Install `@elaan/react-core` directly when you want the **hooks with entirely your
own components**, on a platform where you supply your own realtime transport (or
none).

## Provider

```tsx
import { ElaanProvider } from "@elaan/react-core";

<ElaanProvider
  apiBase="https://api.elaan.io/v1"
  tokenProvider={tokenProvider}   // () => Promise<{ token, contactId }>, from YOUR backend
  realtime={undefined}            // a RealtimeTransport, or omit for polling only
  pollInterval={30000}            // ms; default 30000
>
  {children}
</ElaanProvider>;
```

The web package defaults `realtime` to `fetchStreamTransport`; React Native
leaves it unset (polling). The provider creates the core client + stores once and
tears the inbox store down on unmount.

## Hooks

All require an ancestor `<ElaanProvider>`.

```tsx
import {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "@elaan/react-core";

// Inbox: state + actions
const {
  notifications, // ElaanNotification[]
  unreadCount,
  loading,
  connected,     // realtime stream live?
  refresh, markRead, markUnread, markAllRead, remove,
} = useNotifications();

// Just the badge number
const count = useUnreadCount();

// Preference matrix + mutators
const { preferences, loading, refresh, setPreference, clearPreference } =
  usePreferences();
// preferences: [{ notification_type_key, channels: [{ channel, enabled, overridden }] }]

// Device tokens
const { register, unregister } = usePush();
await register(deviceToken, "expo", "ios"); // provider, platform?
```

Under the hood the hooks subscribe to the `@elaan/core` stores via
`useSyncExternalStore`, so they get polling, realtime merge, and optimistic
updates for free.

## Also re-exported

For convenience so a downstream package can depend on just `@elaan/react-core`:
`ElaanClient`, `ElaanError`, `fetchStreamTransport`, and the core types
(`ElaanNotification`, `TypePreference`, `Channel`, `PushProvider`, `Platform`, …).

## Building a component library on top

This package **is** the recommended base for a custom React component set — web
or native. Consume the hooks, render your own markup, and (on web) inject
`fetchStreamTransport` via the provider's `realtime` prop. See
[`@elaan/react`](https://www.npmjs.com/package/@elaan/react) and
[`@elaan/react-native`](https://www.npmjs.com/package/@elaan/react-native) for two
worked examples.

## License

MIT
