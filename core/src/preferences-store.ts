import type { ElaanClient } from "./client";
import type { Channel, TypePreference } from "./types";

export interface PreferencesState {
  preferences: TypePreference[];
  loading: boolean;
}

export interface PreferencesStore {
  getState(): PreferencesState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  setPreference(
    notificationTypeKey: string,
    channel: Channel,
    enabled: boolean,
  ): Promise<void>;
  clearPreference(notificationTypeKey: string, channel: Channel): Promise<void>;
}

/** Framework-agnostic, observable preferences store (matrix + optimistic writes). */
export function createPreferencesStore(client: ElaanClient): PreferencesStore {
  let state: PreferencesState = { preferences: [], loading: true };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const set = (patch: Partial<PreferencesState>) => {
    state = { ...state, ...patch };
    emit();
  };

  async function refresh(): Promise<void> {
    set({ loading: true });
    try {
      set({ preferences: await client.getPreferences(), loading: false });
    } catch {
      set({ loading: false });
    }
  }

  async function setPreference(
    notificationTypeKey: string,
    channel: Channel,
    enabled: boolean,
  ): Promise<void> {
    set({
      preferences: state.preferences.map((tp) =>
        tp.notification_type_key === notificationTypeKey
          ? {
              ...tp,
              channels: tp.channels.map((c) =>
                c.channel === channel ? { ...c, enabled, overridden: true } : c,
              ),
            }
          : tp,
      ),
    });
    try {
      await client.setPreference(notificationTypeKey, channel, enabled);
    } finally {
      void refresh();
    }
  }

  async function clearPreference(
    notificationTypeKey: string,
    channel: Channel,
  ): Promise<void> {
    try {
      await client.clearPreference(notificationTypeKey, channel);
    } finally {
      void refresh();
    }
  }

  void refresh();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    setPreference,
    clearPreference,
  };
}
