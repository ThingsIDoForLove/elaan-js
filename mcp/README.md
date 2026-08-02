# @elaanio/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Elaan](https://elaan.io), so
the tedious half of a notification integration happens in your editor instead of by hand in a
console: creating notification types, writing templates for three channels, setting up per-tenant
brands, and working out why a message did not arrive.

**Documentation:** [elaan.io/docs.html](https://elaan.io/docs.html)

## Setup

Create a **service key** (`sk_…`) in [the console](https://console.elaan.io), then add the server to
your assistant's MCP config. Nothing to install — `npx` fetches it on first run.

**Claude Code** — `.mcp.json` in your project, or `~/.claude.json` for every project:

```json
{
  "mcpServers": {
    "elaan": {
      "command": "npx",
      "args": ["-y", "@elaanio/mcp"],
      "env": { "ELAAN_API_KEY": "sk_..." }
    }
  }
}
```

**Cursor** — the same block in `.cursor/mcp.json`. Most other MCP clients take the same shape.

Self-hosting Elaan? Point it at your own install:

```json
"env": {
  "ELAAN_API_KEY": "sk_...",
  "ELAAN_API_BASE": "https://elaan.internal.example.com/v1"
}
```

## What it can do

| Area | Tools |
| --- | --- |
| Notification types | list, get, create, update (channel defaults, variables, opt-out policy), delete, restore |
| Templates | list, get, create, update, delete across email / inbox / push; preview an email render; report templates affected by a type's variables |
| Brands | list, create, update (values and sender), delete |
| Contacts | list, get, create, read and set preferences |
| Sending | trigger a notification to 1–100 recipients |
| Debugging | event status with per-channel outcomes, the delivery log with filters, aggregate stats |

Ask for what you want and let it do the fan-out:

> Create an `order_shipped` type that goes to email and the inbox, with an `order_id` variable, then
> write both templates using our `acme` brand.

> A customer says they never got their shipping email. Event id is `01J…` — what happened?

## What it deliberately cannot do

**Transport credentials.** `/v1/email-transport` and `/v1/push-transport` are not exposed at all.
They hold SMTP passwords and FCM service accounts, and an agent has no business reading or rotating
them. Configure those in the console.

**See your API key.** It is read from the environment, never accepted as a tool argument, because
arguments are model-visible and end up in transcripts.

Note that `delete_template` is a **hard** delete with no restore, while `delete_notification_type` is
soft and reversible with `restore_notification_type`. `trigger_notification` sends real messages.

## Development

```bash
pnpm install
pnpm --filter @elaanio/mcp build
pnpm --filter @elaanio/mcp test    # spawns the server, speaks JSON-RPC to a stub API
```

The test drives the real binary over stdio rather than importing the source, which is how it caught
a zod v4 behaviour that made every `create_notification_type` call fail before it left the process.

## Licence

MIT
