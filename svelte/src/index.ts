import {
  ElaanClient,
  createInboxStore,
  createPreferencesStore,
  fetchStreamTransport,
  type InboxState,
  type InboxStore,
  type PreferencesState,
  type PreferencesStore,
  type Platform,
  type PushProvider,
  type RealtimeTransport,
  type TokenProvider,
} from "@elaanio/core";

/**
 * A Svelte-compatible readable store: `subscribe(run)` calls `run` immediately
 * with the current value and again on every change, returning an unsubscribe.
 * This is exactly Svelte's store contract, so `$store` auto-subscription works.
 */
export interface Readable<T> {
  subscribe(run: (value: T) => void): () => void;
}

function toReadable<T>(
  getState: () => T,
  subscribe: (listener: () => void) => () => void,
): Readable<T> {
  return {
    subscribe(run) {
      run(getState());
      return subscribe(() => run(getState()));
    },
  };
}

export interface ElaanInbox {
  /** `$inbox.state` → { notifications, loading, connected }. */
  state: Readable<InboxState>;
  /** `$inbox.unreadCount` → number. */
  unreadCount: Readable<number>;
  refresh: InboxStore["refresh"];
  markRead: InboxStore["markRead"];
  markUnread: InboxStore["markUnread"];
  markAllRead: InboxStore["markAllRead"];
  remove: InboxStore["remove"];
  /** Tear down polling + realtime (call from onDestroy). */
  destroy: InboxStore["destroy"];
}

export interface ElaanPreferences {
  /** `$preferences.state` → { preferences, loading }. */
  state: Readable<PreferencesState>;
  refresh: PreferencesStore["refresh"];
  setPreference: PreferencesStore["setPreference"];
  clearPreference: PreferencesStore["clearPreference"];
}

export interface ElaanPush {
  register(
    value: string,
    provider: PushProvider,
    platform?: Platform,
  ): Promise<unknown>;
  unregister(value: string, provider: PushProvider): Promise<unknown>;
}

export interface Elaan {
  client: ElaanClient;
  inbox: ElaanInbox;
  preferences: ElaanPreferences;
  push: ElaanPush;
}

export interface CreateElaanOptions {
  /** The API base incl. version prefix, e.g. "https://api.elaan.io/v1". */
  apiBase: string;
  /** Returns a short-lived contact token + id, minted by YOUR backend. */
  tokenProvider: TokenProvider;
  /** Realtime transport; defaults to fetch-SSE. Pass null for polling only. */
  realtime?: RealtimeTransport | null;
  /** Inbox poll interval in ms (safety net alongside realtime). Default 30000. */
  pollInterval?: number;
}

/**
 * Create the Elaan client + reactive stores for a Svelte app. Call once (e.g. in
 * a root component or a module) and use `$`-syntax on the stores. Call
 * `elaan.inbox.destroy()` from `onDestroy` when you're done.
 */
export function createElaan(opts: CreateElaanOptions): Elaan {
  const {
    apiBase,
    tokenProvider,
    realtime = fetchStreamTransport,
    pollInterval,
  } = opts;

  const client = new ElaanClient(apiBase, () => tokenProvider());
  const inbox = createInboxStore(client, { realtime, pollInterval });
  const preferences = createPreferencesStore(client);

  return {
    client,
    inbox: {
      state: toReadable(inbox.getState, inbox.subscribe),
      unreadCount: toReadable(inbox.getUnreadCount, inbox.subscribe),
      refresh: inbox.refresh,
      markRead: inbox.markRead,
      markUnread: inbox.markUnread,
      markAllRead: inbox.markAllRead,
      remove: inbox.remove,
      destroy: inbox.destroy,
    },
    preferences: {
      state: toReadable(preferences.getState, preferences.subscribe),
      refresh: preferences.refresh,
      setPreference: preferences.setPreference,
      clearPreference: preferences.clearPreference,
    },
    push: {
      register: (value, provider, platform) =>
        client.addPushSubscription(value, provider, platform),
      unregister: (value, provider) =>
        client.removePushSubscription(value, provider),
    },
  };
}

export { ElaanClient, ElaanError, fetchStreamTransport } from "@elaanio/core";
export type {
  Channel,
  PushProvider,
  Platform,
  ElaanNotification,
  ChannelPreference,
  TypePreference,
  ElaanToken,
  TokenProvider,
  RealtimeTransport,
  InboxState,
  PreferencesState,
} from "@elaanio/core";
