# Elaan JavaScript SDKs

Client SDKs for [Elaan](https://elaan.io) — drop-in notification inbox,
preferences, and push-token management for your users' frontends.

This is the **JavaScript/TypeScript** family. Swift and Kotlin/Android live in
their own repos (`elaan-swift`, `elaan-kotlin`).

## Packages

| Package | What it is | Registry |
|---|---|---|
| [`@elaanio/core`](./core) | Framework-agnostic foundation — API client, types, observable inbox/preferences stores, and a realtime-transport interface. No UI, no framework. | npm |
| [`@elaanio/react-core`](./react-core) | React bindings only (no DOM) — `ElaanProvider` + hooks (`useNotifications`, `useUnreadCount`, `usePreferences`, `usePush`, `useBrowserPush`) over the core stores. Shared by web and native. | npm |
| [`@elaanio/react`](./react) | React (web) components — notification bell, feed, and preferences UI, plus real-time updates over SSE-on-fetch. | npm |
| [`@elaanio/react-native`](./react-native) | React Native components over the same hooks; realtime over SSE (`react-native-sse`) with polling fallback. | npm |
| [`@elaanio/vue`](./vue) | Vue 3 components + composables — bell, feed, and preferences, with fetch-SSE realtime. | npm |
| [`@elaanio/svelte`](./svelte) | Svelte stores (headless) — reactive inbox, unread count, and preferences; bring your own markup. | npm |
| [`@elaanio/elements`](./elements) | Framework-agnostic Web Components — `<elaan-bell>` / `<elaan-feed>` / `<elaan-preferences>`. Drop into any page or framework. | npm |

### How they fit together

```
@elaanio/core                  vanilla TS: client · stores · realtime transport
   ├─ @elaanio/react-core           React provider + hooks (framework, no DOM)
   │    ├─ @elaanio/react                web components + fetch-SSE realtime
   │    └─ @elaanio/react-native         RN components (SSE via react-native-sse)
   ├─ @elaanio/vue                  Vue 3 components + composables
   ├─ @elaanio/svelte               Svelte stores (headless)
   └─ @elaanio/elements             Web Components (works anywhere)
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
    // provider: "expo" | "fcm" | "apns" | "onesignal"
    register(expoToken, "expo", "ios");
  }, [expoToken]);
}
```

### Browser push (the `web_push` channel)

A separate channel from mobile push, not a provider under it — a contact's opt-out
is keyed by `(type, channel)`, so "no browser nags, keep my phone alerts" has to be
expressible.

There is no token to hand in here, only a handshake to perform, so `useBrowserPush`
does the whole thing: permission, service worker registration, `subscribe()`, and
converting the subscription's two keys into what the API stores.

```tsx
import { useBrowserPush } from "@elaanio/react";
import type { BrowserPushResult } from "@elaanio/react";

function PushToggle() {
  const push = useBrowserPush({ serviceWorkerUrl: "/sw.js" });
  const [note, setNote] = useState<string | null>(null);
  if (!push.supported) return null;

  // Handle the result, and catch: the hook rethrows genuine faults after setting
  // `push.error`, so passing `push.subscribe` straight to onClick turns one into an
  // unhandled rejection.
  const onClick = async () => {
    try {
      if (push.subscribed) {
        setNote((await push.unsubscribe()) ? null : "Nothing to turn off.");
      } else {
        setNote(explain(await push.subscribe()));
      }
    } catch {
      setNote(push.error?.message ?? "Something went wrong.");
    }
  };

  return (
    <>
      <button onClick={onClick} disabled={push.busy || push.permission === "denied"}>
        {push.subscribed ? "Turn off" : "Turn on"} browser notifications
      </button>
      {note && <p>{note}</p>}
    </>
  );
}

function explain(result: BrowserPushResult): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case "denied":
      return "Notifications are blocked for this site. Change it in site settings — the browser won't ask again.";
    case "dismissed":
      return "No problem — you can turn these on any time.";
    case "not-configured":
      return "Browser notifications aren't set up for this account yet.";
    case "unsupported":
      return "This browser can't do notifications.";
  }
}
```

`subscribe()` resolves to a result rather than throwing, because the failures are
states to render: `unsupported`, `denied`, `dismissed`, `not-configured`. `denied`
is the one to handle deliberately — the browser will not prompt again, so the only
way forward is site settings.

Your service worker must show the notification. If it doesn't, the browser
substitutes its own "site has been updated in the background" notice:

```js
// sw.js — bundle this; a classic service worker can't `import`.
import { handlePush, handleNotificationClick } from "@elaanio/core/service-worker";

self.addEventListener("push", handlePush);
self.addEventListener("notificationclick", handleNotificationClick);
```

The account needs a VAPID keypair (Push Transport in the console). Without one
`subscribe()` returns `not-configured` — the SDK checks before it prompts, so a
one-shot permission isn't spent on an account that can't send.

It also needs a **browser push template** for each notification type you send, but
the SDK cannot check that and does not claim to: subscribing succeeds and the sends
then fail server-side with "no resolvable template". If notifications never arrive
for a browser that reports itself subscribed, that is the first thing to check —
the delivery log in the console names it directly.

A runnable version of all of this is in
[`examples/web-push-demo`](./examples/web-push-demo).

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
  --elaan-z: 1000;           /* popover stacking order */
  /* --elaan-font is unset by default, so the components inherit your
     app's type stack. Name a stack here to pin one instead. */
}
```

Every component also takes `className` and any other DOM attribute, applied to
its root element, so you can scope the variables to a subtree instead of
`:root`:

```tsx
<NotificationBell className={styles.scope} />
```

**Dark mode** follows the OS by default and can be driven by your app instead:
a `dark` class or `data-theme="dark"` on any ancestor switches the palette, so
a manual theme toggle (the Tailwind and shadcn default) works without you
redeclaring the variables. Override the variables inside your own media query
or under your own selector to customize either palette.

The rules are wrapped in `@layer elaan`, so your own unlayered CSS beats them
without having to out-specify anything. Each element carries a stable `elaan-*`
class (`.elaan-bell`, `.elaan-feed`, `.elaan-item`, …), and a row in the feed
carries `data-unread` while it is unread, if you need finer control.

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
