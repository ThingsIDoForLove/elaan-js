import EventSource from "react-native-sse";
import type { RealtimeTransport, StreamNotification } from "@elaanio/core";

/**
 * SSE realtime transport for React Native, backed by `react-native-sse` — an
 * XHR-based EventSource that (unlike the browser's native one) can send the
 * `Authorization` header our contact-token auth needs. Drop-in for the core
 * `RealtimeTransport` seam.
 *
 * We manage reconnection here (rather than react-native-sse's built-in polling)
 * so every attempt re-reads a fresh token via `client.authHeader()`. The inbox
 * store keeps polling as a safety net, so a missed signal is never a lost
 * notification; on a deployment with realtime off (404/503) we stop and let
 * polling carry it.
 */
export const reactNativeSseTransport: RealtimeTransport = (client, handlers) => {
  let closed = false;
  let es: EventSource<"notification"> | null = null;
  let backoff = 1000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function open(): Promise<void> {
    if (closed) return;
    // The stream URL embeds the contact id and the header carries the token —
    // neither exists until the token provider has resolved, so wait for it.
    try {
      await client.ready();
    } catch {
      if (!closed) retry();
      return;
    }
    if (closed) return;

    es = new EventSource<"notification">(client.streamUrl(), {
      headers: { Authorization: client.authHeader() },
      pollingInterval: 0, // disable built-in reconnect; we do it (fresh token each time)
    });

    es.addEventListener("open", () => {
      if (closed) return;
      backoff = 1000;
      handlers.onOpen?.();
    });

    es.addEventListener("notification", (event) => {
      if (closed || event.type !== "notification" || !event.data) return;
      try {
        handlers.onNotification?.(JSON.parse(event.data) as StreamNotification);
      } catch {
        /* ignore malformed frame */
      }
    });

    es.addEventListener("error", (event) => {
      if (closed) return;
      handlers.onUnavailable?.();
      const status = (event as { xhrStatus?: number }).xhrStatus;
      es?.removeAllEventListeners();
      es?.close();
      es = null;
      if (status === 404 || status === 503) {
        closed = true; // realtime not enabled on this deployment — polling covers it
        return;
      }
      if (status === 401 || status === 403) {
        // Expired/rotated contact token. Drop it so the next open() mints a fresh
        // one; without this we'd retry the same dead token forever.
        client.invalidateToken();
      }
      retry();
    });
  }

  /** Reconnect with capped backoff, re-reading the token on the next open(). */
  function retry(): void {
    if (closed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      backoff = Math.min(backoff * 2, 15000);
      void open();
    }, backoff);
  }

  void open();
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    es?.removeAllEventListeners();
    es?.close();
  };
};
