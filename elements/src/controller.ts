import {
  ElaanClient,
  createInboxStore,
  createPreferencesStore,
  fetchStreamTransport,
  type InboxStore,
  type PreferencesStore,
  type RealtimeTransport,
  type TokenProvider,
} from "@elaanio/core";

export interface ElaanController {
  client: ElaanClient;
  inbox: InboxStore;
  preferences: PreferencesStore;
}

export interface ConfigureElaanOptions {
  /** The API base incl. version prefix, e.g. "https://api.elaan.io/v1". */
  apiBase: string;
  /** Returns a short-lived contact token + id, minted by YOUR backend. */
  tokenProvider: TokenProvider;
  /** Realtime transport; defaults to fetch-SSE. Pass null for polling only. */
  realtime?: RealtimeTransport | null;
  /** Inbox poll interval in ms (safety net alongside realtime). Default 30000. */
  pollInterval?: number;
}

let controller: ElaanController | null = null;
const listeners = new Set<() => void>();

/**
 * Configure the singleton Elaan client + stores the custom elements read from.
 * Call once (e.g. after the user signs in). Calling again tears down the old
 * controller and swaps in a new one; mounted elements re-bind automatically.
 */
export function configureElaan(opts: ConfigureElaanOptions): ElaanController {
  if (controller) controller.inbox.destroy();
  const {
    apiBase,
    tokenProvider,
    realtime = fetchStreamTransport,
    pollInterval,
  } = opts;
  const client = new ElaanClient(apiBase, () => tokenProvider());
  controller = {
    client,
    inbox: createInboxStore(client, { realtime, pollInterval }),
    preferences: createPreferencesStore(client),
  };
  listeners.forEach((l) => l());
  return controller;
}

export function getElaanController(): ElaanController | null {
  return controller;
}

/** Subscribe to controller (re)configuration; returns an unsubscribe. */
export function onControllerChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
