# @elaanio/svelte

Svelte stores for [Elaan](https://elaan.io): a reactive notification inbox,
unread count, and preference matrix, plus push device-token registration —
backed by your Elaan account.

**Documentation:** [elaan.io/docs/svelte.html](https://elaan.io/docs/svelte.html)

```bash
npm install @elaanio/svelte
```

Peer dependency: `svelte` >= 4. This package is **headless** — it gives you
Svelte-native stores (usable with `$` auto-subscription) and you render your own
markup. That's the idiomatic Svelte approach and keeps the styling entirely
yours. (Realtime uses SSE in the browser with automatic polling fallback.)

## Setup

The SDK never sees your API key — your backend mints a short-lived **contact
token** (`POST /v1/contacts/tokens`) and you hand the SDK a `tokenProvider`.

```ts
// elaan.ts
import { createElaan } from "@elaanio/svelte";

export const elaan = createElaan({
  apiBase: "https://api.elaan.io/v1",
  async tokenProvider() {
    const res = await fetch("/api/elaan-token");
    const { token, contact_id } = await res.json();
    return { token, contactId: contact_id };
  },
});
```

## Inbox

```svelte
<script lang="ts">
  import { onDestroy } from "svelte";
  import { elaan } from "./elaan";

  const { state, unreadCount, markRead, markAllRead, remove } = elaan.inbox;
  onDestroy(() => elaan.inbox.destroy());
</script>

<header>
  Notifications
  {#if $unreadCount > 0}
    <span class="badge">{$unreadCount}</span>
    <button on:click={() => markAllRead()}>Mark all read</button>
  {/if}
</header>

{#if $state.loading && $state.notifications.length === 0}
  <p>Loading…</p>
{:else if $state.notifications.length === 0}
  <p>You're all caught up.</p>
{:else}
  <ul>
    {#each $state.notifications as n (n.id)}
      <li class:unread={!n.is_read} on:click={() => markRead(n.id)}>
        <strong>{n.title}</strong>
        {#if n.body}<p>{n.body}</p>{/if}
        <button on:click|stopPropagation={() => remove(n.id)}>×</button>
      </li>
    {/each}
  </ul>
{/if}
```

## Preferences

```svelte
<script lang="ts">
  import { elaan } from "./elaan";
  const { state, setPreference } = elaan.preferences;
</script>

{#each $state.preferences as tp (tp.notification_type_key)}
  <div>
    <span>{tp.notification_type_key}</span>
    {#each tp.channels as c (c.channel)}
      <label>
        <input
          type="checkbox"
          checked={c.enabled}
          on:change={(e) =>
            setPreference(tp.notification_type_key, c.channel, e.currentTarget.checked)}
        />
        {c.channel}
      </label>
    {/each}
  </div>
{/each}
```

## Push device tokens

```ts
import { elaan } from "./elaan";

// provider: "fcm" | "apns" | "expo" | "onesignal"
await elaan.push.register(fcmToken, "fcm", "web");
```

## API

`createElaan({ apiBase, tokenProvider, realtime?, pollInterval? })` returns:

- `client` — the raw `ElaanClient` for one-off calls.
- `inbox` — `{ state, unreadCount, refresh, markRead, markUnread, markAllRead, remove, destroy }`. `state` and `unreadCount` are Svelte-readable stores.
- `preferences` — `{ state, refresh, setPreference, clearPreference }`.
- `push` — `{ register, unregister }`.

Pass `realtime: null` for polling only, or `pollInterval` (ms) to tune polling.

## License

MIT
