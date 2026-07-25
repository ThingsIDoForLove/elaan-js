# Elaan JavaScript SDKs

Client SDKs for [Elaan](https://elaan.io) — drop-in notification inbox,
preferences, and push-token management for your users' frontends.

This is the **JavaScript/TypeScript** family. Swift and Kotlin/Android live in
their own repos (`elaan-swift`, `elaan-kotlin`).

## Packages

| Package | What it is | Registry |
|---|---|---|
| [`@elaan/core`](./core) | Framework-agnostic foundation — API client, types, observable inbox/preferences stores, and a realtime-transport interface. No UI, no framework. | npm |
| [`@elaan/react-core`](./react-core) | React bindings only (no DOM) — `ElaanProvider` + hooks (`useNotifications`, `useUnreadCount`, `usePreferences`, `usePush`) over the core stores. Shared by web and native. | npm |
| [`@elaan/react`](./react) | Web components — notification bell, feed, and preferences UI, plus real-time updates over SSE-on-fetch. | npm |
| [`@elaan/react-native`](./react-native) | React Native components over the same hooks (polling-based). | npm |

### How they fit together

```
@elaan/core              vanilla TS: client · stores · realtime transport
   └─ @elaan/react-core       React provider + hooks (framework, no DOM)
        ├─ @elaan/react            web components + fetch-SSE realtime
        └─ @elaan/react-native     RN components (polling)
```

The non-visual logic lives once in `@elaan/core`; each UI package is a thin
layer of components over the shared `@elaan/react-core` hooks. Adding another
framework (Vue, Svelte, …) means a new binding package over `@elaan/core`, not a
reimplementation of the client or stores.

## Quick start (React, web)

```tsx
import { ElaanProvider, NotificationBell, Preferences } from "@elaan/react";

function App() {
  return (
    <ElaanProvider apiBase="https://api.elaan.io" token={contactToken}>
      <NotificationBell />
      <Preferences />
    </ElaanProvider>
  );
}
```

See each package's README for its full API.

## Development

This repo is a [pnpm](https://pnpm.io) workspace.

```bash
pnpm install     # install all packages
pnpm -r build    # build every package (topological order)
pnpm -r typecheck
```

## License

MIT — see [LICENSE](./LICENSE).
