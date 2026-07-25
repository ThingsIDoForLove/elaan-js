# Elaan JavaScript SDKs

Client SDKs for [Elaan](https://elaan.io) — drop-in notification inbox,
preferences, and push-token management for your users' frontends.

This is the **JavaScript/TypeScript** family. Swift and Kotlin/Android live in
their own repos (`elaan-swift`, `elaan-kotlin`).

## Packages

| Package | What it is | Registry |
|---|---|---|
| [`@elaanio/core`](./core) | Framework-agnostic foundation — API client, types, observable inbox/preferences stores, and a realtime-transport interface. No UI, no framework. | npm |
| [`@elaanio/react-core`](./react-core) | React bindings only (no DOM) — `ElaanProvider` + hooks (`useNotifications`, `useUnreadCount`, `usePreferences`, `usePush`) over the core stores. Shared by web and native. | npm |
| [`@elaanio/react`](./react) | React (web) components — notification bell, feed, and preferences UI, plus real-time updates over SSE-on-fetch. | npm |
| [`@elaanio/react-native`](./react-native) | React Native components over the same hooks; realtime over SSE (`react-native-sse`) with polling fallback. | npm |
| [`@elaanio/vue`](./vue) | Vue 3 components + composables — bell, feed, and preferences, with fetch-SSE realtime. | npm |
| [`@elaanio/svelte`](./svelte) | Svelte stores (headless) — reactive inbox, unread count, and preferences; bring your own markup. | npm |

### How they fit together

```
@elaanio/core                  vanilla TS: client · stores · realtime transport
   ├─ @elaanio/react-core           React provider + hooks (framework, no DOM)
   │    ├─ @elaanio/react                web components + fetch-SSE realtime
   │    └─ @elaanio/react-native         RN components (SSE via react-native-sse)
   ├─ @elaanio/vue                  Vue 3 components + composables
   └─ @elaanio/svelte               Svelte stores (headless)
```

The non-visual logic lives once in `@elaanio/core`; each framework package is a
thin adapter over the core client + observable stores (React goes through the
shared `@elaanio/react-core` hooks; Vue and Svelte bind the stores to their own
reactivity). Adding another framework means a new binding over `@elaanio/core`,
not a reimplementation of the client or stores.

## Authentication (all packages)

The SDK never sees your API key. Your backend mints a short-lived **contact
token** for the signed-in user (`POST /v1/contacts/tokens` with your service
key, by `external_id`) and returns it to the client. You pass the SDK a
`tokenProvider` callback that fetches a fresh token from your own endpoint; it
refreshes automatically on expiry. See [`@elaanio/react`](./react#readme) for the
full token flow.

## Quick start — React (web)

```tsx
import { ElaanProvider, NotificationBell, Preferences } from "@elaanio/react";
import "@elaanio/react/styles.css";

async function tokenProvider() {
  const res = await fetch("/api/elaan-token"); // your endpoint
  const { token, contact_id } = await res.json();
  return { token, contactId: contact_id };
}

export function App() {
  return (
    <ElaanProvider apiBase="https://api.elaan.io/v1" tokenProvider={tokenProvider}>
      <NotificationBell />
      <Preferences />
    </ElaanProvider>
  );
}
```

## Quick start — React Native

Same provider and hooks; the components render with React Native primitives
(`View`/`FlatList`/`Switch`/`Modal`) instead of DOM, and there's no stylesheet
to import. Realtime works over SSE via [`react-native-sse`](https://www.npmjs.com/package/react-native-sse)
(RN can't stream `fetch`, but its XHR-based EventSource can send the auth
header), wired into the RN provider by default and falling back to polling when
the deployment has realtime off. Pass `realtime={null}` for polling only.

```tsx
import {
  ElaanProvider,
  NotificationBell,
  NotificationFeed,
  Preferences,
} from "@elaanio/react-native";

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
      {/* A bell + badge that opens the inbox in a modal card */}
      <NotificationBell />

      {/* …or the inbox inline as a full screen */}
      <NotificationFeed emptyText="Nothing here yet." />

      {/* per-type × channel preference switches */}
      <Preferences />
    </ElaanProvider>
  );
}
```

### Registering a device token (Expo / FCM)

```tsx
import { usePush } from "@elaanio/react-native";

function useRegisterPush(expoToken: string) {
  const { register } = usePush();
  useEffect(() => {
    // provider: "expo" | "fcm" | "apns" | "onesignal" | "webpush"
    register(expoToken, "expo", "ios");
  }, [expoToken]);
}
```

## Theming & styling

**Web (`@elaanio/react`)** ships a stylesheet driven entirely by CSS variables, so
you theme it without touching component internals. Import the stylesheet once,
then override the variables on `:root` (or any ancestor of the components):

```css
:root {
  --elaan-accent: #7c3aed;   /* brand color: badges, links, active states */
  --elaan-accent-ink: #fff;  /* text/icon on top of the accent */
  --elaan-bg: #ffffff;
  --elaan-bg-hover: #f4f6f9;
  --elaan-text: #1a1d23;
  --elaan-muted: #6b7280;
  --elaan-border: #e5e7eb;
  --elaan-danger: #ef4444;
  --elaan-radius: 10px;
  --elaan-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.3);
}
```

The default theme already adapts to light/dark via `prefers-color-scheme`;
override the same variables inside your own media query to customize dark mode.
Each element also carries a stable `elaan-*` class (`.elaan-bell`,
`.elaan-feed`, `.elaan-item`, …) if you need finer CSS control.

**React Native (`@elaanio/react-native`)** components use `StyleSheet` with a
small built-in palette (accent, background, text, muted, border). There are no
CSS variables in RN, so for anything beyond the defaults — brand fonts, custom
row layouts, dark-mode palettes — build your own components on the hooks (next
section). That's the intended path for heavy RN customization.

## Building your own components

The packaged components are deliberately thin. When the defaults don't fit —
your own markup, a design system, a different layout, or a framework we don't
ship yet — drop down a layer. Pick the lowest one you need:

**1. Same framework, your own UI → use the hooks.** `@elaanio/react` and
`@elaanio/react-native` both re-export the hooks from `@elaanio/react-core`. Render
whatever you like; the hook owns loading, polling, realtime, and optimistic
updates:

```tsx
import { useNotifications, usePreferences } from "@elaanio/react"; // or /react-native

function MyInbox() {
  const { notifications, unreadCount, loading, markRead, markAllRead, remove } =
    useNotifications();

  if (loading && notifications.length === 0) return <Spinner />;
  return (
    <MyList
      items={notifications}
      onOpen={(n) => markRead(n.id)}
      onDismiss={(n) => remove(n.id)}
      onClearAll={markAllRead}
    />
  );
}

function MyPrefs() {
  const { preferences, setPreference, clearPreference } = usePreferences();
  // preferences: [{ notification_type_key, channels: [{ channel, enabled, overridden }] }]
  // setPreference(typeKey, channel, enabled) / clearPreference(typeKey, channel)
}
```

Available hooks: `useNotifications`, `useUnreadCount`, `usePreferences`,
`usePush` — all require an ancestor `<ElaanProvider>`.

**2. A different framework (Vue, Svelte, Solid, vanilla) → use `@elaanio/core`.**
The core exposes the same logic as framework-agnostic observable stores. This is
exactly what `@elaanio/react-core` is built on, so a new binding is small:

```ts
import { ElaanClient, createInboxStore } from "@elaanio/core";

const client = new ElaanClient("https://api.elaan.io/v1", tokenProvider);
const inbox = createInboxStore(client, { pollInterval: 30000 });

inbox.subscribe(() => render(inbox.getState())); // getState() / getUnreadCount()
inbox.markRead(id);                              // + markUnread / markAllRead / remove / refresh
// inbox.destroy() when you tear down
```

Wire `store.subscribe` + `store.getState` into your framework's reactivity
(Vue `ref`, Svelte store contract, `useSyncExternalStore`, …). For one-off calls
that don't need a store, `ElaanClient` has every endpoint directly. If you build
a binding for another framework, a PR adding an `@elaanio/<framework>` package is
very welcome.

## Development

This repo is a [pnpm](https://pnpm.io) workspace.

```bash
pnpm install     # install all packages
pnpm -r build    # build every package (topological order)
pnpm -r typecheck
```

## Releasing

Versioning is **manual semver, per package**. To cut a release:

1. Bump `"version"` in the `package.json` of each package you're releasing.
2. Commit, then push a tag:
   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```
3. The [`Publish`](./.github/workflows/publish.yml) workflow builds, typechecks,
   and runs `pnpm -r publish` — which publishes each package in dependency order
   (rewriting `workspace:*` to real versions) and **skips any version already on
   npm**, so releasing a subset just works.

One-time setup (repo owner):

- Own the **`@elaan` scope/org** on [npmjs.com](https://www.npmjs.com/) (the
  packages are scoped `@elaanio/*`).
- Add an **`NPM_TOKEN`** repository secret (Settings → Secrets and variables →
  Actions) — an npm **Automation** token with publish rights to the scope.

Packages publish as public via each one's `publishConfig.access`, with npm
provenance attested from the workflow.

## License

MIT — see [LICENSE](./LICENSE).
