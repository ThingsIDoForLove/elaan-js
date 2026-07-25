import type { ElaanClient } from "./client";
import type { RealtimeTransport } from "./realtime";
import type { ElaanNotification } from "./types";

export interface InboxState {
  notifications: ElaanNotification[];
  loading: boolean;
  connected: boolean; // realtime stream live
}

export interface InboxStore {
  getState(): InboxState;
  getUnreadCount(): number;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  markRead(id: string): Promise<void>;
  markUnread(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  remove(id: string): Promise<void>;
  destroy(): void;
}

export interface InboxOptions {
  /** Poll interval in ms (a safety net alongside realtime). 0 disables. Default 30000. */
  pollInterval?: number;
  /** Inject a realtime transport for instant updates; omit for polling only. */
  realtime?: RealtimeTransport | null;
}

/**
 * A framework-agnostic, observable inbox store. Owns all the logic — initial
 * load, polling, realtime merge, optimistic read/unread/delete — behind a plain
 * getState/subscribe interface any UI layer can bind to (React via
 * useSyncExternalStore, Vue via reactivity, etc.).
 */
export function createInboxStore(
  client: ElaanClient,
  opts: InboxOptions = {},
): InboxStore {
  const { pollInterval = 30000, realtime = null } = opts;
  let state: InboxState = { notifications: [], loading: true, connected: false };
  let destroyed = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const set = (patch: Partial<InboxState>) => {
    state = { ...state, ...patch };
    emit();
  };
  const patchNote = (id: string, fields: Partial<ElaanNotification>) =>
    set({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...fields } : n,
      ),
    });

  async function refresh(): Promise<void> {
    try {
      const list = await client.listNotifications();
      if (!destroyed) set({ notifications: list, loading: false });
    } catch {
      if (!destroyed) set({ loading: false });
    }
  }

  async function markRead(id: string): Promise<void> {
    patchNote(id, { is_read: true, read_at: new Date().toISOString() });
    try {
      await client.markRead(id);
    } catch {
      void refresh();
    }
  }

  async function markUnread(id: string): Promise<void> {
    patchNote(id, { is_read: false, read_at: null });
    try {
      await client.markUnread(id);
    } catch {
      void refresh();
    }
  }

  async function markAllRead(): Promise<void> {
    const now = new Date().toISOString();
    set({
      notifications: state.notifications.map((n) =>
        n.is_read ? n : { ...n, is_read: true, read_at: now },
      ),
    });
    try {
      await client.markAllRead();
    } catch {
      void refresh();
    }
  }

  async function remove(id: string): Promise<void> {
    set({ notifications: state.notifications.filter((n) => n.id !== id) });
    try {
      await client.deleteNotification(id);
    } catch {
      void refresh();
    }
  }

  void refresh();
  const pollTimer =
    pollInterval > 0 ? setInterval(() => void refresh(), pollInterval) : null;

  let closeRealtime: (() => void) | null = null;
  if (realtime) {
    closeRealtime = realtime(client, {
      onOpen: () => set({ connected: true }),
      onUnavailable: () => set({ connected: false }),
      onNotification: (data) => {
        if (destroyed) return;
        if (data.truncated || !data.title) {
          void refresh(); // oversized payload — pull the full row
          return;
        }
        if (state.notifications.some((n) => n.id === data.id)) return;
        set({
          notifications: [
            {
              id: data.id,
              notification_type_key: data.notification_type_key ?? "",
              title: data.title ?? "",
              body: data.body ?? "",
              created_at: data.created_at ?? new Date().toISOString(),
              read_at: null,
              is_read: false,
            },
            ...state.notifications,
          ],
        });
      },
    });
  }

  return {
    getState: () => state,
    getUnreadCount: () =>
      state.notifications.reduce((n, x) => (x.is_read ? n : n + 1), 0),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    markRead,
    markUnread,
    markAllRead,
    remove,
    destroy: () => {
      destroyed = true;
      if (pollTimer) clearInterval(pollTimer);
      closeRealtime?.();
      listeners.clear();
    },
  };
}
