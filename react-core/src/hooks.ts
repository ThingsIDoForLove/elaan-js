import { useCallback, useSyncExternalStore } from "react";
import type { Channel, Platform, PushProvider } from "@elaanio/core";
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

export type { Channel, Platform, PushProvider };
