import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  ElaanClient,
  createInboxStore,
  createPreferencesStore,
  type InboxStore,
  type PreferencesStore,
  type RealtimeTransport,
  type TokenProvider,
} from "@elaan/core";

interface ElaanContextValue {
  client: ElaanClient;
  inbox: InboxStore;
  preferences: PreferencesStore;
}

const ElaanContext = createContext<ElaanContextValue | null>(null);

export interface ElaanProviderProps {
  /** The API base incl. version prefix, e.g. "https://api.elaan.io/v1". */
  apiBase: string;
  /** Returns a short-lived contact token + contact id, minted by YOUR backend. */
  tokenProvider: TokenProvider;
  /**
   * Realtime transport for live updates. The web package injects the fetch-SSE
   * transport; React Native leaves it null and polls. Omit for polling only.
   */
  realtime?: RealtimeTransport | null;
  /** Inbox poll interval in ms (safety net alongside realtime). Default 30000. */
  pollInterval?: number;
  children: ReactNode;
}

/**
 * The framework binding: creates the framework-agnostic core stores once and
 * exposes them via context. All logic lives in @elaan/core; this is just wiring.
 */
export function ElaanProvider({
  apiBase,
  tokenProvider,
  realtime = null,
  pollInterval,
  children,
}: ElaanProviderProps) {
  const tokenProviderRef = useRef(tokenProvider);
  tokenProviderRef.current = tokenProvider;

  const value = useMemo<ElaanContextValue>(() => {
    const client = new ElaanClient(apiBase, () => tokenProviderRef.current());
    return {
      client,
      inbox: createInboxStore(client, { realtime, pollInterval }),
      preferences: createPreferencesStore(client),
    };
  }, [apiBase, realtime, pollInterval]);

  useEffect(() => () => value.inbox.destroy(), [value]);

  return <ElaanContext.Provider value={value}>{children}</ElaanContext.Provider>;
}

export function useElaanContext(): ElaanContextValue {
  const ctx = useContext(ElaanContext);
  if (!ctx) {
    throw new Error("Elaan hooks/components must be used within <ElaanProvider>.");
  }
  return ctx;
}
