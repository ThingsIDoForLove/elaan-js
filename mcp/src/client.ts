/**
 * Thin HTTP client for the Elaan management API.
 *
 * Everything here runs on the developer's own machine under their service key,
 * which is why the key is read from the environment and never accepted as a
 * tool argument: a tool argument is model-visible and ends up in transcripts.
 */

const DEFAULT_BASE = "https://api.elaan.io/v1";

export class ElaanApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly method: string,
    readonly path: string,
  ) {
    super(`${method} ${path} failed with ${status}: ${detail}`);
    this.name = "ElaanApiError";
  }
}

export class ElaanClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = process.env.ELAAN_API_BASE || DEFAULT_BASE,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/$/, "") + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      // The API renders every handled error as {"detail": "..."}. Surfacing that
      // string verbatim is the whole point: it is what lets the model correct
      // its own call rather than guess at why a 409 happened.
      let detail = response.statusText;
      try {
        const parsed = (await response.json()) as { detail?: unknown };
        if (typeof parsed.detail === "string") detail = parsed.detail;
        else if (parsed.detail) detail = JSON.stringify(parsed.detail);
      } catch {
        /* non-JSON body; statusText is the best we have */
      }
      throw new ElaanApiError(response.status, detail, method, path);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>("GET", path, undefined, query);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
