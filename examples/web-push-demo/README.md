# Browser push demo

Subscribe a browser, receive a notification, unsubscribe. Uses `@elaanio/react`'s
`useBrowserPush` and `@elaanio/core/service-worker`, from the working tree rather
than the published packages — so it breaks when they break.

> **The tenant API key in this demo does not belong in a browser.** A real app
> mints the contact token on its own backend (it holds the key, calls
> `POST /v1/contacts/tokens`, returns only the short-lived token). A tenant key in
> client-side JS can read and write every contact in the account. Use a throwaway
> account against a local API.

## Setup

The account needs three things first, all in the console:

1. **A VAPID keypair** under Push Transport. Generate one with
   `npx web-push generate-vapid-keys`. Without it the demo reports "this account
   has no Web Push transport" — which is the 404 from `GET /v1/web-push/public-key`,
   surfaced rather than swallowed.
2. **A notification type** with `web_push` among its default channels.
3. **A browser push template** for that type, under Browser Push Templates. A
   channel with no template can never be delivered on, so the preference matrix
   shows it as unreachable and a send fails with "no resolvable template".

Then a contact whose `external_id` matches `VITE_ELAAN_CONTACT_EXTERNAL_ID`.
Contact creation is tenant-only, so create it via the console or the API.

```sh
cp .env.example .env.local   # then fill in the key
pnpm install                 # from the repo root
pnpm dev                     # http://localhost:5180
```

Service workers need a secure context. `localhost` counts, so plain http works
here; a LAN address or an http:// staging host does not, and
`navigator.serviceWorker` is simply absent there.

## Trying it

Click **Subscribe** and accept the prompt. Then trigger a send — from the
console's Playground, or directly:

```sh
curl -X POST http://localhost:8000/v1/notifications \
  -H "Authorization: Bearer $TENANT_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"notification_type_key":"order_shipped","external_id":"demo-contact",
       "variables":{"order_id":"A-1234"}}'
```

The notification should appear even with the tab closed or backgrounded — that is
the whole point of push over the SSE inbox stream. Clicking it focuses this tab, or
opens the template's click-through URL.

## What's worth reading

- `src/sw.ts` — the entire service-worker integration: two listeners. It is
  bundled to `public/sw.js` because a classic service worker can't `import`, and
  registering the source with `{ type: "module" }` works in Chrome but not Firefox.
- `src/App.tsx` — `explain()` maps each failure to something a person can act on.
  `denied` is the one that matters: the browser will not prompt again, so "try
  again" is a lie and site settings is the only way forward.
- `src/config.ts` — the token mint, i.e. the part you replace with your backend.

## Worth testing in both

Chrome and Firefox use different push services, and the VAPID `aud` claim is
origin-scoped — so they are genuinely separate paths through the server's sender,
not one path twice.
