# @elaan/core

The framework-agnostic foundation of the [Elaan](https://elaan.io) JavaScript
SDKs: the API client, wire types, observable inbox/preferences **stores**, and a
pluggable **realtime transport** — no UI, no framework, no DOM.

```bash
npm install @elaan/core
```

You usually don't install this directly. Use a binding:

- **React (web)** → [`@elaan/react`](https://www.npmjs.com/package/@elaan/react)
- **React Native** → [`@elaan/react-native`](https://www.npmjs.com/package/@elaan/react-native)

Reach for `@elaan/core` when you're **building your own binding** (Vue, Svelte,
Solid, vanilla JS, or another React component set) — it holds all the logic those
packages wrap.

## What's in it

| Export | What it does |
|---|---|
| `ElaanClient` | Typed client for the contact-facing API. Manages the contact token (fetch + refresh on 401) and exposes every endpoint. |
| `ElaanError` | Thrown on non-2xx responses (`status`, `body`). |
| `createInboxStore(client, opts)` | Observable inbox store: initial load, polling, realtime merge, optimistic read/unread/delete. |
| `createPreferencesStore(client)` | Observable preference-matrix store with optimistic mutators. |
| `fetchStreamTransport` | SSE-over-`fetch` realtime transport (browsers / streaming runtimes). |
| `RealtimeTransport` | The transport interface — implement it to plug in another realtime mechanism. |
| types | `ElaanNotification`, `TypePreference`, `ChannelPreference`, `Channel`, `PushProvider`, `Platform`, `ElaanToken`, `TokenProvider`. |

## The client

```ts
import { ElaanClient } from "@elaan/core";

// tokenProvider: () => Promise<{ token, contactId }> — minted by YOUR backend
// via POST /v1/contacts/tokens. The client never sees your API key.
const client = new ElaanClient("https://api.elaan.io/v1", tokenProvider);

await client.listNotifications();      // ElaanNotification[]  (pass true for unread only)
await client.unreadCount();            // { unread: number }
await client.markRead(id);
await client.markUnread(id);
await client.markAllRead();
await client.deleteNotification(id);

await client.getPreferences();         // TypePreference[]
await client.setPreference(typeKey, channel, enabled);
await client.clearPreference(typeKey, channel);

await client.addPushSubscription(token, "expo", "ios"); // provider, platform?
await client.removePushSubscription(token, "expo");
```

## The stores (recommended)

Stores add loading state, polling, realtime, and optimistic updates on top of the
client. They're plain observables — `getState()` + `subscribe(listener)` — so any
reactivity system can bind to them.

```ts
import { ElaanClient, createInboxStore } from "@elaan/core";

const client = new ElaanClient("https://api.elaan.io/v1", tokenProvider);
const inbox = createInboxStore(client, {
  pollInterval: 30000,          // ms; 0 disables. Default 30000.
  realtime: fetchStreamTransport, // omit/null for polling only
});

const unsub = inbox.subscribe(() => {
  const { notifications, loading, connected } = inbox.getState();
  const unread = inbox.getUnreadCount();
  render(notifications, unread);
});

inbox.markRead(id);   // + markUnread, markAllRead, remove, refresh
// teardown:
unsub();
inbox.destroy();
```

`createPreferencesStore(client)` has the same shape: `getState()` →
`{ preferences: TypePreference[], loading }`, plus `refresh`, `setPreference`,
`clearPreference`.

### Binding to a framework

Wire `subscribe` + `getState` into your framework's reactivity — e.g. React's
`useSyncExternalStore(inbox.subscribe, inbox.getState)`, a Svelte store, or a Vue
`ref` updated in a `subscribe` callback. That's exactly how
[`@elaan/react-core`](https://www.npmjs.com/package/@elaan/react-core) is built.

## Realtime transport

The stores are realtime-agnostic. A `RealtimeTransport` is
`(client, handlers) => close`; `fetchStreamTransport` is the built-in SSE-over-
`fetch` implementation (reconnects with capped backoff; stops and signals
`onUnavailable` on 404/503 when a deployment has realtime off). Environments
without `fetch` body streaming (e.g. React Native) omit the transport and rely on
polling, or supply their own.

## License

MIT
