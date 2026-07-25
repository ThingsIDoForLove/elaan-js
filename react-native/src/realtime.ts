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

  function open(): void {
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
      es?.close();
      es = null;
      if (status === 404 || status === 503) {
        closed = true; // realtime not enabled on this deployment — polling covers it
        return;
      }
      // transient (network drop, or 401 while a REST poll refreshes the token) —
      // reconnect with capped backoff, re-reading the header on the next open().
      timer = setTimeout(() => {
        backoff = Math.min(backoff * 2, 15000);
        open();
      }, backoff);
    });
  }

  open();
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    es?.removeAllEventListeners();
    es?.close();
  };
};
