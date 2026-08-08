# @elaanio/elements

Framework-agnostic **Web Components** for [Elaan](https://elaan.io):
`<elaan-bell>`, `<elaan-feed>`, and `<elaan-preferences>`. They work in plain
HTML or inside any framework (Angular, Vue, Svelte, Rails/Laravel views,
WordPress…) — no framework dependency, styles encapsulated in shadow DOM.

**Documentation:** [elaan.io/docs/web-components.html](https://elaan.io/docs/web-components.html)

```bash
npm install @elaanio/elements
```

Or straight from a CDN — the standalone build inlines `@elaanio/core` and
registers the tags on load, so no bundler and no `defineElaanElements()` call:

```html
<script src="https://unpkg.com/@elaanio/elements"></script>
<script>
  Elaan.configureElaan({ apiBase: "https://api.elaan.io/v1", tokenProvider });
</script>
```

## Use

Register the elements once, configure the client (the SDK never sees your API
key — your backend mints a short-lived contact token), then drop the tags in.

```ts
import { defineElaanElements, configureElaan } from "@elaanio/elements";

defineElaanElements();

configureElaan({
  apiBase: "https://api.elaan.io/v1",
  async tokenProvider() {
    const res = await fetch("/api/elaan-token"); // your endpoint
    const { token, contact_id } = await res.json();
    return { token, contactId: contact_id };
  },
});
```

```html
<!-- A bell with an unread badge + popover inbox -->
<elaan-bell></elaan-bell>

<!-- Or the inbox feed inline -->
<elaan-feed empty-text="Nothing here yet."></elaan-feed>

<!-- A preferences center: a toggle per notification type × channel -->
<elaan-preferences></elaan-preferences>
```

Elements can be placed before or after `configureElaan()` — they bind (and
re-bind) automatically when a controller is configured. Realtime uses SSE in the
browser with automatic polling fallback; pass `realtime: null` to
`configureElaan` for polling only.

### Reacting to clicks

`<elaan-bell>` and `<elaan-feed>` emit a `notificationclick` event (bubbling,
`composed`) whose `detail` is the clicked notification:

```js
document.querySelector("elaan-feed")
  .addEventListener("notificationclick", (e) => {
    console.log("opened", e.detail); // ElaanNotification
  });
```

## Theming

Override the `--elaan-*` CSS custom properties on `:root` (they inherit through
the shadow boundary). Light/dark is automatic via `prefers-color-scheme`.

```css
:root {
  --elaan-accent: #7c3aed;
  --elaan-radius: 6px;
}
```

Available tokens: `--elaan-accent`, `--elaan-accent-ink`, `--elaan-bg`,
`--elaan-bg-hover`, `--elaan-text`, `--elaan-muted`, `--elaan-border`,
`--elaan-danger`, `--elaan-radius`, `--elaan-shadow`.

`--elaan-accent-ink` is the text colour on top of `--elaan-accent` (the unread
badge). It defaults to a near-black that reads against the default light-blue
accent — if you set a **dark** accent, set the ink to something light too:

```css
:root {
  --elaan-accent: #7c3aed;
  --elaan-accent-ink: #ffffff;
}
```

## Push device tokens

Use the exposed client:

```ts
import { getElaanController } from "@elaanio/elements";

const c = getElaanController();
// provider: "fcm" | "apns" | "expo" | "onesignal"
await c?.client.addPushSubscription(fcmToken, "fcm", "web");
```

## License

MIT
