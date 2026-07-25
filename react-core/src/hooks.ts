import { useCallback, useSyncExternalStore } from "react";
import type { Channel, Platform, PushProvider } from "@elaan/core";
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
    loading: state.loading,
    refresh: preferences.refresh,
    setPreference: preferences.setPreference,
    clearPreference: preferences.clearPreference,
  };
}

/** Register / remove a device token for push. */
export function usePush() {
  const { client } = useElaanContext();
  const register = useCallback(
    (value: string, provider: PushProvider, platform?: Platform) =>
      client.addPushSubscription(value, provider, platform),
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
