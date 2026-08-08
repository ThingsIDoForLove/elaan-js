import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Channel, Platform, PushProvider } from "@elaanio/core";
// The browser-only entry point, kept separate from "@elaanio/core" precisely so
// React Native never evaluates it. `useBrowserPush` is the only thing here that
// touches it, and it is documented as web-only.
import {
  browserPushPermission,
  browserPushSupported,
  currentBrowserSubscription,
  subscribeToBrowserPush,
  unsubscribeFromBrowserPush,
  type BrowserPushResult,
} from "@elaanio/core/web-push";
import { useElaanContext } from "./context";

/** The inbox: notifications, unread count, live-connection state, and actions. */
export function useNotifications() {
  const { inbox } = useElaanContext();
  const state = useSyncExternalStore(
    inbox.subscribe,
    inbox.getState,
    inbox.getState,
  );
  const unreadCount = useSyncExternalStore(
    inbox.subscribe,
    inbox.getUnreadCount,
    inbox.getUnreadCount,
  );
  return {
    notifications: state.notifications,
    loading: state.loading,
    connected: state.connected,
    unreadCount,
    refresh: inbox.refresh,
    markRead: inbox.markRead,
    markUnread: inbox.markUnread,
    markAllRead: inbox.markAllRead,
    remove: inbox.remove,
  };
}

/** Just the unread count (bell badges). */
export function useUnreadCount(): number {
  const { inbox } = useElaanContext();
  return useSyncExternalStore(
    inbox.subscribe,
    inbox.getUnreadCount,
    inbox.getUnreadCount,
  );
}

/** The preference matrix + mutators. */
export function usePreferences() {
  const { preferences } = useElaanContext();
  const state = useSyncExternalStore(
    preferences.subscribe,
    preferences.getState,
    preferences.getState,
  );
  return {
    preferences: state.preferences,
    language: state.language,
    loading: state.loading,
    refresh: preferences.refresh,
    setPreference: preferences.setPreference,
    clearPreference: preferences.clearPreference,
    setLanguage: preferences.setLanguage,
  };
}

/** Register / remove a device token for push.
 *
 * A pass-through: the app obtains the token itself (expo-notifications,
 * firebase-messaging) and hands it over. For *browser* push use
 * `useBrowserPush`, which does the obtaining too — there is no equivalent of a
 * token to be handed in, only a handshake to be performed. */
export function usePush() {
  const { client } = useElaanContext();
  const register = useCallback(
    (
      value: string,
      provider: PushProvider,
      platform?: Platform,
      keys?: { auth: string; p256dh: string },
    ) => client.addPushSubscription(value, provider, platform, keys),
    [client],
  );
  const unregister = useCallback(
    (value: string, provider: PushProvider) =>
      client.removePushSubscription(value, provider),
    [client],
  );
  return { register, unregister };
}

/**
 * Browser push (the `web_push` channel) as a piece of UI state.
 *
 * Unlike `usePush` this owns the whole handshake — permission, service worker,
 * subscribe, key conversion — because there is nothing for the app to pass in.
 * What it gives back is what a toggle needs to render honestly: whether the
 * browser can do this at all, whether the user has already refused, and whether
 * this browser is currently subscribed.
 *
 * `subscribe()` resolves to a discriminated result rather than throwing, because
 * "unsupported" and "denied" are ordinary states to render, not errors. Genuine
 * faults (the API unreachable) land in `error`.
 *
 * Browser-only. It imports `@elaanio/core/web-push`, so do not call it from React
 * Native — `usePush` is that platform's path.
 */
export function useBrowserPush(options: { serviceWorkerUrl: string }) {
  const { serviceWorkerUrl } = options;
  const { client } = useElaanContext();
  const [supported] = useState(browserPushSupported);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(browserPushPermission);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Set once the first check has run, so a UI can tell "not subscribed" from
  // "don't know yet" and avoid flashing an Off toggle for a subscribed user.
  const [checked, setChecked] = useState(false);

  // Read the *browser's* view of the subscription, which is the authority on
  // whether a push can still arrive here — the server's row can outlive a
  // subscription the user revoked in site settings.
  useEffect(() => {
    if (!supported) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    currentBrowserSubscription()
      .then((subscription) => {
        if (cancelled) return;
        setEndpoint(subscription?.endpoint ?? null);
      })
      .catch(() => {
        /* no registration yet is the normal cold state, not an error */
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async (): Promise<BrowserPushResult> => {
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeToBrowserPush({ client, serviceWorkerUrl });
      if (result.ok) setEndpoint(result.endpoint);
      // Re-read rather than assume: a granted prompt is the common case, but a
      // dismissed one leaves it at "default" and the toggle must not claim
      // otherwise.
      setPermission(browserPushPermission());
      return result;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      throw failure;
    } finally {
      setBusy(false);
    }
  }, [client, serviceWorkerUrl]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const removed = await unsubscribeFromBrowserPush({ client });
      setEndpoint(null);
      return removed;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      throw failure;
    } finally {
      setBusy(false);
    }
  }, [client]);

  return {
    supported,
    permission,
    /** Null until the first check completes — see `checked`. */
    endpoint,
    subscribed: endpoint !== null,
    checked,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}

export type { Channel, Platform, PushProvider };
