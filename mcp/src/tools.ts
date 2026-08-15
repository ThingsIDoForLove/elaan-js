/**
 * Tool definitions.
 *
 * Scope is "everything except credentials": the server can read and write the
 * catalog (notification types, templates, brands), manage contacts, trigger
 * sends and inspect delivery — but it deliberately does not expose
 * /v1/email-transport or /v1/push-transport, because those hold SMTP passwords
 * and FCM service accounts and an agent has no business reading or rotating
 * them.
 *
 * Tools are grouped by aggregate and kept coarse where the API is fine-grained:
 * `update_notification_type` fans out to the three PATCH/PUT routes for
 * channel defaults, variables and opt-out policy, because from the caller's
 * point of view that is one edit, and three near-identical tools would be three
 * chances to pick the wrong one.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElaanApiError, type ElaanClient } from "./client.js";

const CHANNELS = ["email", "inbox", "push"] as const;
type Channel = (typeof CHANNELS)[number];

const TEMPLATE_PATH: Record<Channel, string> = {
  email: "/email-templates",
  inbox: "/inbox-templates",
  push: "/push-templates",
};

/**
 * A partial `{channel: boolean}` map.
 *
 * Must be `partialRecord`, not `record`: zod v4 treats a record keyed by an
 * enum as *exhaustive*, so `z.record(z.enum(CHANNELS), z.boolean())` silently
 * makes all three channels required and rejects `{"email": true}` before the
 * request is ever made. A plain object of optional booleans also works but
 * strips unknown keys silently, which would turn a mistyped channel name into
 * a no-op instead of an error.
 */
function channelFlags() {
  return z.partialRecord(z.enum(CHANNELS), z.boolean());
}

/** Render a successful result. JSON, because the consumer is a model. */
function ok(data: unknown) {
  const text = data === undefined ? "OK" : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

/**
 * Turn a failure into a readable tool error rather than an exception.
 *
 * The API's own `detail` string is the useful part — "notification type
 * 'order_shipped' does not exist" tells the model exactly how to fix its next
 * call, where a bare 404 does not.
 */
function fail(error: unknown) {
  const text =
    error instanceof ElaanApiError
      ? `Elaan API error ${error.status} on ${error.method} ${error.path}\n${error.detail}`
      : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: "text" as const, text }], isError: true };
}

async function run<T>(fn: () => Promise<T>) {
  try {
    return ok(await fn());
  } catch (error) {
    return fail(error);
  }
}

export function registerTools(server: McpServer, api: ElaanClient) {
  // ---------------------------------------------------------------- catalog

  server.registerTool(
    "list_notification_types",
    {
      title: "List notification types",
      description:
        "List every notification type in the account, with its per-channel defaults, declared variables and opt-out policy. Start here when you need to know what already exists.",
      inputSchema: {
        include_deleted: z
          .boolean()
          .optional()
          .describe("Include soft-deleted types. Default false."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ include_deleted }) =>
      run(() => api.get("/notification-types", { include_deleted })),
  );

  server.registerTool(
    "get_notification_type",
    {
      title: "Get a notification type",
      description: "Fetch a single notification type by its key.",
      inputSchema: { key: z.string().describe("The type key, e.g. 'order_shipped'.") },
      annotations: { readOnlyHint: true },
    },
    async ({ key }) => run(() => api.get(`/notification-types/${encodeURIComponent(key)}`)),
  );

  server.registerTool(
    "create_notification_type",
    {
      title: "Create a notification type",
      description:
        "Create a notification type. The key is its permanent identity and is referenced by every template and preference, so choose it carefully — it cannot be renamed. Set allows_opt_out to false for transactional types (password resets, email verification) that a recipient must not be able to switch off; note that this removes only the recipient's veto, and channel_defaults still decides which channels fire.",
      inputSchema: {
        key: z
          .string()
          .describe("Permanent identity, e.g. 'order_shipped'. Lowercase with underscores."),
        channel_defaults: channelFlags()
          .optional()
          .describe("Which channels fire by default, e.g. {\"email\": true, \"inbox\": true}."),
        variables: z
          .array(z.string())
          .optional()
          .describe("Variable names this type's templates expect, e.g. ['order_id']."),
        allows_opt_out: z
          .boolean()
          .optional()
          .describe("Whether a contact may override the defaults. Default true."),
      },
    },
    async (input) => run(() => api.post("/notification-types", input)),
  );

  server.registerTool(
    "update_notification_type",
    {
      title: "Update a notification type",
      description:
        "Update any combination of a type's channel defaults, declared variables and opt-out policy. Only the fields you pass are changed. Note that channel_defaults and variables are replaced wholesale, not merged.",
      inputSchema: {
        key: z.string(),
        channel_defaults: channelFlags()
          .optional()
          .describe("Replaces the existing defaults entirely."),
        variables: z.array(z.string()).optional().describe("Replaces the existing list entirely."),
        allows_opt_out: z.boolean().optional(),
      },
    },
    async ({ key, channel_defaults, variables, allows_opt_out }) =>
      run(async () => {
        const id = encodeURIComponent(key);
        const applied: string[] = [];
        if (channel_defaults !== undefined) {
          await api.patch(`/notification-types/${id}/channel-defaults`, { channel_defaults });
          applied.push("channel_defaults");
        }
        if (variables !== undefined) {
          await api.put(`/notification-types/${id}/variables`, { variables });
          applied.push("variables");
        }
        if (allows_opt_out !== undefined) {
          await api.patch(`/notification-types/${id}/opt-out-policy`, { allows_opt_out });
          applied.push("allows_opt_out");
        }
        if (applied.length === 0) {
          throw new Error("Nothing to update: pass at least one of channel_defaults, variables, allows_opt_out.");
        }
        return { key, updated: applied, type: await api.get(`/notification-types/${id}`) };
      }),
  );

  server.registerTool(
    "delete_notification_type",
    {
      title: "Delete a notification type",
      description:
        "Soft-delete a notification type. The row survives because templates and preferences reference it by key, and restore_notification_type brings it back. Templates of a deleted type can still be edited.",
      inputSchema: { key: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ key }) => run(() => api.delete(`/notification-types/${encodeURIComponent(key)}`)),
  );

  server.registerTool(
    "restore_notification_type",
    {
      title: "Restore a notification type",
      description: "Undo a soft delete, bringing the type and its configuration back.",
      inputSchema: { key: z.string() },
    },
    async ({ key }) =>
      run(() => api.post(`/notification-types/${encodeURIComponent(key)}/restore`)),
  );

  // -------------------------------------------------------------- templates

  server.registerTool(
    "list_templates",
    {
      title: "List templates for a channel",
      description:
        "List every template on one channel, across all notification types, brands and languages.",
      inputSchema: { channel: z.enum(CHANNELS) },
      annotations: { readOnlyHint: true },
    },
    async ({ channel }) => run(() => api.get(TEMPLATE_PATH[channel])),
  );

  server.registerTool(
    "get_template",
    {
      title: "Get a template",
      description: "Fetch one template by id.",
      inputSchema: { channel: z.enum(CHANNELS), template_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ channel, template_id }) =>
      run(() => api.get(`${TEMPLATE_PATH[channel]}/${encodeURIComponent(template_id)}`)),
  );

  server.registerTool(
    "create_template",
    {
      title: "Create a template",
      description:
        "Create a template for one notification type on one channel. Content is Liquid. A value is read from one of three places, and the slot itself says which: {{ contact.first_name }} for the recipient (their attributes, plus contact.email, contact.language, contact.external_id), {{ brand.logo }} for the resolved brand's values, and {{ order_id }} for the trigger's own variables. `contact` and `brand` are reserved, so a variable cannot use either name. A slot nobody filled renders empty rather than failing the send. Loops handle list data: {% for line in lines %} ... {{ line.description }} ... {% endfor %}; conditions and the standard Liquid filters are available too. In an email BODY every interpolated value is HTML-escaped (use `| safe` to pass markup through deliberately); titles, push and inbox text are not. A template that does not parse, or that names a filter that does not exist, is rejected at save time. Leave branding_key and language unset for the default variant; a template must exist on a channel for that channel to be offered to contacts at all. Required fields per channel: email needs subject and body; inbox needs title and body; push needs at least one of title, body or data.",
      inputSchema: {
        channel: z.enum(CHANNELS),
        notification_type_key: z.string(),
        branding_key: z
          .string()
          .optional()
          .describe("Brand override. Omit for the account-default template."),
        language: z
          .string()
          .optional()
          .describe("Language variant tag. Omit for the language-less default, which is the terminal fallback and should always exist."),
        subject: z.string().optional().describe("Email only. Required for email."),
        title: z.string().optional().describe("Inbox and push."),
        body: z.string().optional().describe("All channels. Required for email and inbox."),
        data: z
          .record(z.string(), z.string())
          .optional()
          .describe("Push only. Arbitrary key/value payload delivered with the push."),
      },
    },
    async ({ channel, ...rest }) =>
      run(() => api.post(TEMPLATE_PATH[channel], templateBody(channel, rest, true))),
  );

  server.registerTool(
    "update_template",
    {
      title: "Update a template",
      description:
        "Replace a template's content. Same field rules as create_template. The notification type, brand and channel of an existing template cannot be changed — delete and recreate to move it.",
      inputSchema: {
        channel: z.enum(CHANNELS),
        template_id: z.string(),
        language: z.string().optional(),
        subject: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional(),
        data: z.record(z.string(), z.string()).optional(),
      },
    },
    async ({ channel, template_id, ...rest }) =>
      run(() =>
        api.put(
          `${TEMPLATE_PATH[channel]}/${encodeURIComponent(template_id)}`,
          templateBody(channel, rest, false),
        ),
      ),
  );

  server.registerTool(
    "delete_template",
    {
      title: "Delete a template",
      description:
        "Permanently delete a template. This is a hard delete with no restore. Deleting the last template for a (type, channel) also removes that channel from the contact-facing preference matrix, because a channel with no template can never be delivered.",
      inputSchema: { channel: z.enum(CHANNELS), template_id: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ channel, template_id }) =>
      run(() => api.delete(`${TEMPLATE_PATH[channel]}/${encodeURIComponent(template_id)}`)),
  );

  server.registerTool(
    "preview_email_render",
    {
      title: "Preview a rendered email",
      description:
        "Render an email template with sample variables and a chosen brand, without sending anything. Use this to check that slots resolve and that the brand-major fallback picked the template you expected.",
      inputSchema: {
        notification_type_key: z.string(),
        branding_key: z.string(),
        variables: z.record(z.string(), z.string()).optional(),
        language: z.string().optional(),
      },
    },
    async (input) => run(() => api.post("/email-templates/render", input)),
  );

  server.registerTool(
    "list_templates_affected_by",
    {
      title: "List templates affected by a type's variables",
      description:
        "Report which email templates reference which of a notification type's declared variables. Advisory only — a template may legitimately use brand keys and contact attributes that are not declared variables — but it is the right check before changing or removing one.",
      inputSchema: { notification_type_key: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ notification_type_key }) =>
      run(() =>
        api.get(`/email-templates/affected-by/${encodeURIComponent(notification_type_key)}`),
      ),
  );

  // --------------------------------------------------------------- branding

  server.registerTool(
    "list_brandings",
    {
      title: "List brands",
      description:
        "List the account's brands. Every account has exactly one default brand, which cannot be deleted and is the fallback whenever a send names no brand or an unknown one.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => run(() => api.get("/brandings")),
  );

  server.registerTool(
    "create_branding",
    {
      title: "Create a brand",
      description:
        "Create a brand. `values` is an arbitrary key/value bag interpolated into templates, so one template can render for every customer you have — put whatever the templates reference here (product name, logo URL, colour, support address).",
      inputSchema: {
        key: z.string().describe("Tenant-defined identity, e.g. 'acme'."),
        values: z.record(z.string(), z.string()).optional(),
        from_address: z.string().optional().describe("Sender address for this brand's email."),
        from_name: z.string().optional(),
      },
    },
    async (input) => run(() => api.post("/brandings", input)),
  );

  server.registerTool(
    "update_branding",
    {
      title: "Update a brand",
      description:
        "Update a brand's values and/or its email sender. Values are replaced wholesale, not merged — read the brand first if you mean to change one key.",
      inputSchema: {
        key: z.string(),
        values: z.record(z.string(), z.string()).optional(),
        from_address: z.string().nullable().optional(),
        from_name: z.string().nullable().optional(),
      },
    },
    async ({ key, values, from_address, from_name }) =>
      run(async () => {
        const id = encodeURIComponent(key);
        const applied: string[] = [];
        if (values !== undefined) {
          await api.put(`/brandings/${id}/values`, { values });
          applied.push("values");
        }
        if (from_address !== undefined || from_name !== undefined) {
          await api.put(`/brandings/${id}/sender`, { from_address, from_name });
          applied.push("sender");
        }
        if (applied.length === 0) throw new Error("Nothing to update: pass values and/or sender fields.");
        return { key, updated: applied, branding: await api.get(`/brandings/${id}`) };
      }),
  );

  server.registerTool(
    "delete_branding",
    {
      title: "Delete a brand",
      description:
        "Delete a brand. The account default cannot be deleted and will return 409. Templates overriding this brand are not deleted, but sends naming it will fall back to the default.",
      inputSchema: { key: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ key }) => run(() => api.delete(`/brandings/${encodeURIComponent(key)}`)),
  );

  // --------------------------------------------------------------- contacts

  server.registerTool(
    "list_contacts",
    {
      title: "List contacts",
      description: "List or search contacts.",
      inputSchema: {
        search: z.string().optional(),
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (query) => run(() => api.get("/contacts", query)),
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get a contact",
      description:
        "Fetch one contact. Accepts either Elaan's internal id or your own identifier prefixed with 'ext:', e.g. 'ext:crm-12345'.",
      inputSchema: { contact_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ contact_id }) => run(() => api.get(`/contacts/${encodeURIComponent(contact_id)}`)),
  );

  server.registerTool(
    "create_contact",
    {
      title: "Create a contact",
      description:
        "Create a contact. `attributes` are available to every template rendered for this recipient, so anything you would otherwise repeat in every trigger belongs here.",
      inputSchema: {
        external_id: z.string().optional().describe("Your own user id. Strongly recommended."),
        emails: z.array(z.string()).optional(),
        phones: z.array(z.string()).optional(),
        attributes: z.record(z.string(), z.string()).optional(),
        language: z.string().optional(),
      },
    },
    async (input) => run(() => api.post("/contacts", input)),
  );

  server.registerTool(
    "get_contact_preferences",
    {
      title: "Get a contact's preferences",
      description:
        "The per-type by per-channel matrix for one contact, with the effective on/off and whether they overrode the default. Only channels a type can actually reach (i.e. that have a template) are offered, and non-opt-out types are omitted entirely.",
      inputSchema: { contact_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ contact_id }) =>
      run(() => api.get(`/contacts/${encodeURIComponent(contact_id)}/preferences`)),
  );

  server.registerTool(
    "set_contact_preference",
    {
      title: "Set a contact preference",
      description:
        "Override one (type, channel) for one contact. Attempting this on a non-opt-out type returns 409.",
      inputSchema: {
        contact_id: z.string(),
        notification_type_key: z.string(),
        channel: z.enum(CHANNELS),
        enabled: z.boolean(),
      },
    },
    async ({ contact_id, ...body }) =>
      run(() => api.put(`/contacts/${encodeURIComponent(contact_id)}/preferences`, body)),
  );

  // ------------------------------------------------- sending and debugging

  server.registerTool(
    "trigger_notification",
    {
      title: "Trigger a notification",
      description:
        "Send a notification to 1-100 recipients. Returns 202 immediately with one event_id per recipient; delivery happens asynchronously, so use get_notification_event afterwards to see the outcome. An omitted or unknown branding_key falls back to the account default rather than failing. Variables are any JSON: strings, numbers, booleans, nested objects read as {{ order.customer.name }}, and arrays a template loops over with {% for %}. They fill slots at the TOP level; the recipient and the brand have their own namespaces, so `contact` and `brand` are refused as variable names. This sends real messages.",
      inputSchema: {
        notification_type_key: z.string(),
        external_ids: z
          .array(z.string())
          .min(1)
          .max(100)
          .describe("Your own user ids. Duplicates are de-duplicated."),
        branding_key: z.string().optional(),
        variables: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            "Any JSON. Arrays are looped over with {% for %}; nested objects are read as {{ order.customer.name }}. `contact` and `brand` are reserved.",
          ),
      },
    },
    async (input) => run(() => api.post("/notifications", input)),
  );

  server.registerTool(
    "get_notification_event",
    {
      title: "Get a notification event's status",
      description:
        "The outcome of one triggered event: pending, processed or failed, with per-channel errors. Channel failures are isolated, so a broken email template shows here without having blocked the inbox or push delivery of the same event. Start here when someone reports a notification did not arrive.",
      inputSchema: {
        event_id: z.string(),
        include_deliveries: z
          .boolean()
          .optional()
          .describe("Also fetch the per-channel delivery rows. Default true."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ event_id, include_deliveries }) =>
      run(async () => {
        const id = encodeURIComponent(event_id);
        const status = await api.get(`/notifications/${id}`);
        if (include_deliveries === false) return status;
        return { status, deliveries: await api.get(`/notifications/${id}/deliveries`) };
      }),
  );

  server.registerTool(
    "list_deliveries",
    {
      title: "List deliveries",
      description:
        "The delivery log, filterable by channel, status, recipient, notification type and time range. This is the tool for 'did this person get it, and if not why'.",
      inputSchema: {
        channel: z.enum(CHANNELS).optional(),
        status: z.string().optional().describe("Provider status, e.g. 'failed'."),
        contact_id: z.string().optional(),
        external_id: z.string().optional(),
        notification_type: z.string().optional(),
        event_id: z.string().optional(),
        created_from: z.string().optional().describe("ISO 8601 timestamp."),
        created_to: z.string().optional().describe("ISO 8601 timestamp."),
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (query) => run(() => api.get("/deliveries", query)),
  );

  server.registerTool(
    "get_delivery_stats",
    {
      title: "Get delivery stats",
      description: "Aggregate delivery counts for the account.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => run(() => api.get("/stats")),
  );
}

/**
 * Build a channel-specific template body from the flat tool arguments.
 *
 * The three channels have genuinely different payloads, but a discriminated
 * union cannot be expressed as an MCP input schema (which is a flat shape), so
 * the fields are flat and validated here. The error messages name the channel,
 * because "subject is required" is useless when the model has three channels to
 * choose between.
 */
function templateBody(
  channel: Channel,
  fields: {
    notification_type_key?: string;
    branding_key?: string;
    language?: string;
    subject?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
  },
  isCreate: boolean,
) {
  const common = isCreate
    ? {
        notification_type_key: fields.notification_type_key,
        branding_key: fields.branding_key ?? null,
        language: fields.language ?? null,
      }
    : { language: fields.language ?? null };

  if (channel === "email") {
    if (!fields.subject || !fields.body) {
      throw new Error("An email template needs both `subject` and `body`.");
    }
    return { ...common, subject: fields.subject, body: fields.body };
  }
  if (channel === "inbox") {
    if (!fields.title || !fields.body) {
      throw new Error("An inbox template needs both `title` and `body`.");
    }
    return { ...common, title: fields.title, body: fields.body };
  }
  if (!fields.title && !fields.body && !fields.data) {
    throw new Error("A push template needs at least one of `title`, `body` or `data`.");
  }
  return { ...common, title: fields.title, body: fields.body, data: fields.data };
}
