import type {
  ChannelPreference,
  ElaanNotification,
  Platform,
  PushProvider,
  TokenProvider,
  TypePreference,
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

  private base(): string {
    return `/contacts/${encodeURIComponent(this._contactId as string)}`;
  }

  // --- inbox ---
  listNotifications(unreadOnly = false): Promise<ElaanNotification[]> {
    const q = unreadOnly ? "?unread=true" : "";
    return this.request(`${this.base()}/notifications${q}`);
  }
  unreadCount(): Promise<{ unread: number }> {
    return this.request(`${this.base()}/notifications/unread-count`);
  }
  markRead(id: string): Promise<ElaanNotification> {
    return this.request(`${this.base()}/notifications/${id}/read`, {
      method: "POST",
    });
  }
  markUnread(id: string): Promise<ElaanNotification> {
    return this.request(`${this.base()}/notifications/${id}/unread`, {
      method: "POST",
    });
  }
  markAllRead(): Promise<void> {
    return this.request(`${this.base()}/notifications/read-all`, {
      method: "POST",
    });
  }
  deleteNotification(id: string): Promise<void> {
    return this.request(`${this.base()}/notifications/${id}`, {
      method: "DELETE",
    });
  }

  // --- preferences ---
  getPreferences(): Promise<TypePreference[]> {
    return this.request(`${this.base()}/preferences`);
  }
  setPreference(
    notification_type_key: string,
    channel: ChannelPreference["channel"],
    enabled: boolean,
  ): Promise<unknown> {
    return this.request(`${this.base()}/preferences`, {
      method: "PUT",
      body: { notification_type_key, channel, enabled },
    });
  }
  clearPreference(
    notification_type_key: string,
    channel: ChannelPreference["channel"],
  ): Promise<unknown> {
    return this.request(
      `${this.base()}/preferences/${encodeURIComponent(notification_type_key)}/${channel}`,
      { method: "DELETE" },
    );
  }

  // --- push device tokens ---
  addPushSubscription(
    value: string,
    provider: PushProvider,
    platform?: Platform,
  ): Promise<unknown> {
    return this.request(`${this.base()}/push-subscriptions`, {
      method: "POST",
      body: { value, provider, platform },
    });
  }
  removePushSubscription(value: string, provider: PushProvider): Promise<unknown> {
    const q = `?value=${encodeURIComponent(value)}&provider=${provider}`;
    return this.request(`${this.base()}/push-subscriptions${q}`, {
      method: "DELETE",
    });
  }

  // The bare values a raw SSE client needs.
  streamUrl(): string {
    return `${this.apiBase}${this.base()}/stream`;
  }
  authHeader(): string {
    return `Bearer ${this.token}`;
  }
}
