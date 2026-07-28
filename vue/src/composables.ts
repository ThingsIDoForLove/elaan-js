import { computed, onScopeDispose, shallowRef, type ComputedRef, type Ref } from "vue";
import type { Platform, PushProvider } from "@elaanio/core";
import { useElaanContext } from "./context";

/** The inbox: reactive notifications, unread count, connection state, actions. */
export function useNotifications() {
  const { inbox } = useElaanContext();
  const state = shallowRef(inbox.getState());
  const unreadCount = shallowRef(inbox.getUnreadCount());
  const unsub = inbox.subscribe(() => {
    state.value = inbox.getState();
    unreadCount.value = inbox.getUnreadCount();
  });
  onScopeDispose(unsub);

  return {
    notifications: computed(() => state.value.notifications),
    loading: computed(() => state.value.loading),
    connected: computed(() => state.value.connected),
    unreadCount,
    refresh: inbox.refresh,
    markRead: inbox.markRead,
    markUnread: inbox.markUnread,
    markAllRead: inbox.markAllRead,
    remove: inbox.remove,
  };
}

/** Just the unread count (bell badges). */
export function useUnreadCount(): Ref<number> {
  const { inbox } = useElaanContext();
  const count = shallowRef(inbox.getUnreadCount());
  const unsub = inbox.subscribe(() => {
    count.value = inbox.getUnreadCount();
  });
  onScopeDispose(unsub);
  return count;
}

/** The preference matrix + mutators. */
export function usePreferences() {
  const { preferences } = useElaanContext();
  const state = shallowRef(preferences.getState());
  const unsub = preferences.subscribe(() => {
    state.value = preferences.getState();
  });
  onScopeDispose(unsub);

  return {
    preferences: computed(() => state.value.preferences),
    language: computed(() => state.value.language),
    loading: computed(() => state.value.loading),
    refresh: preferences.refresh,
    setPreference: preferences.setPreference,
    clearPreference: preferences.clearPreference,
    setLanguage: preferences.setLanguage,
  };
}

/** Register / remove a device token for push. */
export function usePush() {
  const { client } = useElaanContext();
  return {
    register: (value: string, provider: PushProvider, platform?: Platform) =>
      client.addPushSubscription(value, provider, platform),
    unregister: (value: string, provider: PushProvider) =>
      client.removePushSubscription(value, provider),
  };
}

// Re-exported for consumers building their own components.
export type { ComputedRef, Ref };
