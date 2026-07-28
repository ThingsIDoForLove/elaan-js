import type {
  ChannelPreference,
  ContactPreferences,
  ElaanNotification,
  Platform,
  PushProvider,
  TokenProvider,
} from "./types";

export class ElaanError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ElaanError";
  }
}

/**
 * Talks to the Elaan contact-facing API. Holds a short-lived contact token from
 * the host app's `tokenProvider` (which calls the app's own backend), attaches it
 * as a Bearer, and transparently refreshes once on a 401. Every path is scoped to
 * the token's own contact id.
 */
export class ElaanClient {
  private token: string | null = null;
  private _contactId: string | null = null;
  private inflightToken: Promise<void> | null = null;

  constructor(
    private readonly apiBase: string,
    private readonly tokenProvider: TokenProvider,
  ) {}

  get contactId(): string | null {
    return this._contactId;
  }

  private async ensureToken(): Promise<void> {
    if (this.token) return;
    if (!this.inflightToken) {
      this.inflightToken = (async () => {
        const { token, contactId } = await this.tokenProvider();
        this.token = token;
        this._contactId = contactId;
      })().finally(() => {
        this.inflightToken = null;
      });
    }
    await this.inflightToken;
  }

  /** Force a token refresh on next use (e.g. after an expiry). */
  invalidateToken(): void {
    this.token = null;
  }

  /**
   * Resolve a token (and therefore the contact id) if we don't have one yet.
   * `request()` does this itself; realtime transports must call it explicitly
   * before reading `streamUrl()`/`authHeader()`, which are only meaningful once
   * a token has been minted.
   */
  async ready(): Promise<void> {
    await this.ensureToken();
  }

  async request<T>(
    path: string,
    opts: { method?: string; body?: unknown; retry?: boolean } = {},
  ): Promise<T> {
    await this.ensureToken();
    const { method = "GET", body, retry = true } = opts;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(`${this.apiBase}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ElaanError(0, "Couldn't reach the server.");
    }

    if (res.status === 401 && retry) {
      this.invalidateToken();
      return this.request<T>(path, { ...opts, retry: false });
    }
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data?.detail) detail = String(data.detail);
      } catch {
        /* non-JSON body */
      }
      throw new ElaanError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /**
   * The contact-scoped path prefix. The contact id only exists once a token has
   * been minted, so this MUST be awaited — building a path from a null contact id
   * would silently address `/contacts/null/...`.
   */
  private async base(): Promise<string> {
    await this.ensureToken();
    return this.baseSync();
  }

  private baseSync(): string {
    if (!this._contactId) {
      throw new ElaanError(
        0,
        "No contact id yet — await client.ready() before reading stream URLs.",
      );
    }
    return `/contacts/${encodeURIComponent(this._contactId)}`;
  }

  // --- inbox ---
  async listNotifications(unreadOnly = false): Promise<ElaanNotification[]> {
    const q = unreadOnly ? "?unread=true" : "";
    return this.request(`${await this.base()}/notifications${q}`);
  }
  async unreadCount(): Promise<{ unread: number }> {
    return this.request(`${await this.base()}/notifications/unread-count`);
  }
  async markRead(id: string): Promise<ElaanNotification> {
    return this.request(
      `${await this.base()}/notifications/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    );
  }
  async markUnread(id: string): Promise<ElaanNotification> {
    return this.request(
      `${await this.base()}/notifications/${encodeURIComponent(id)}/unread`,
      { method: "POST" },
    );
  }
  async markAllRead(): Promise<void> {
    return this.request(`${await this.base()}/notifications/read-all`, {
      method: "POST",
    });
  }
  async deleteNotification(id: string): Promise<void> {
    return this.request(
      `${await this.base()}/notifications/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }

  // --- preferences ---
  /**
   * The contact's whole preference centre in one read: their saved preferred
   * `language` (null = default) plus the notification `types` matrix.
   */
  async getPreferences(): Promise<ContactPreferences> {
    return this.request(`${await this.base()}/preferences`);
  }
  async setPreference(
    notification_type_key: string,
    channel: ChannelPreference["channel"],
    enabled: boolean,
  ): Promise<unknown> {
    return this.request(`${await this.base()}/preferences`, {
      method: "PUT",
      body: { notification_type_key, channel, enabled },
    });
  }
  async clearPreference(
    notification_type_key: string,
    channel: ChannelPreference["channel"],
  ): Promise<unknown> {
    return this.request(
      `${await this.base()}/preferences/${encodeURIComponent(notification_type_key)}/${encodeURIComponent(channel)}`,
      { method: "DELETE" },
    );
  }

  // --- preferred language ---
  /**
   * Set (or clear, with `null`) the contact's preferred language. When a matching
   * language variant of a template exists the contact receives it; otherwise they
   * fall back to the default. `language` is a tag like `"es"` or `"pt-br"`.
   */
  async setLanguage(language: string | null): Promise<unknown> {
    return this.request(`${await this.base()}/language`, {
      method: "PUT",
      body: { language },
    });
  }

  // --- push device tokens ---
  async addPushSubscription(
    value: string,
    provider: PushProvider,
    platform?: Platform,
  ): Promise<unknown> {
    return this.request(`${await this.base()}/push-subscriptions`, {
      method: "POST",
      body: { value, provider, platform },
    });
  }
  async removePushSubscription(
    value: string,
    provider: PushProvider,
  ): Promise<unknown> {
    const q = `?value=${encodeURIComponent(value)}&provider=${encodeURIComponent(provider)}`;
    return this.request(`${await this.base()}/push-subscriptions${q}`, {
      method: "DELETE",
    });
  }

  // The bare values a raw SSE client needs. Call `await client.ready()` first —
  // both throw/return a null token until the token provider has resolved.
  streamUrl(): string {
    return `${this.apiBase}${this.baseSync()}/stream`;
  }
  authHeader(): string {
    return `Bearer ${this.token}`;
  }
}
