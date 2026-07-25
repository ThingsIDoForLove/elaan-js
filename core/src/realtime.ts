import type { ElaanClient } from "./client";

export interface StreamNotification {
  id: string;
  title?: string;
  body?: string;
  notification_type_key?: string;
  created_at?: string;
  truncated?: boolean;
}

export interface RealtimeHandlers {
  onOpen?: () => void;
  onNotification?: (data: StreamNotification) => void;
  // The stream can't be used (e.g. realtime disabled on the deployment) — the
  // store should rely on polling.
  onUnavailable?: () => void;
}

/**
 * A realtime transport: given the client + handlers, open a live connection and
 * return a closer. This is the seam that keeps the stores framework-AND-platform
 * agnostic — the web injects `fetchStreamTransport` (below), React Native can pass
 * a polling-only (no transport) or an XHR-based one, etc.
 */
export type RealtimeTransport = (
  client: ElaanClient,
  handlers: RealtimeHandlers,
) => () => void;

/**
 * SSE-over-fetch transport for environments with response-body streaming
 * (browsers, modern server runtimes). Not usable in React Native (no fetch body
 * streaming) — RN falls back to polling. Reconnects with capped backoff; stops on
 * 404/503 (realtime off) and signals `onUnavailable`.
 */
export const fetchStreamTransport: RealtimeTransport = (client, handlers) => {
  let closed = false;
  let controller: AbortController | null = null;
  let backoff = 1000;

  async function connect(): Promise<void> {
    controller = new AbortController();
    try {
      const res = await fetch(client.streamUrl(), {
        headers: {
          Authorization: client.authHeader(),
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });
      if (res.status === 404 || res.status === 503) {
        handlers.onUnavailable?.();
        return; // realtime not enabled — do NOT reconnect
      }
      if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);
      handlers.onOpen?.();
      backoff = 1000;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          emit(buf.slice(0, sep));
          buf = buf.slice(sep + 2);
        }
      }
    } catch {
      /* network drop — fall through to reconnect */
    }
    if (!closed) {
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 15000);
      if (!closed) return connect();
    }
  }

  function emit(frame: string): void {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (!line || line.startsWith(":")) continue; // blank or heartbeat
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      const val = i === -1 ? "" : line.slice(i + 1).replace(/^ /, "");
      if (field === "event") event = val;
      else if (field === "data") data += (data ? "\n" : "") + val;
    }
    if (event !== "notification" || !data) return;
    try {
      handlers.onNotification?.(JSON.parse(data));
    } catch {
      /* ignore malformed frame */
    }
  }

  connect();
  return () => {
    closed = true;
    controller?.abort();
  };
};
