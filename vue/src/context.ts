import {
  defineComponent,
  inject,
  onScopeDispose,
  provide,
  type InjectionKey,
  type PropType,
} from "vue";
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

export interface ElaanContext {
  client: ElaanClient;
  inbox: InboxStore;
  preferences: PreferencesStore;
}

export const ELAAN_KEY: InjectionKey<ElaanContext> = Symbol("elaan");

/**
 * Creates the framework-agnostic core client + stores once and provides them to
 * descendants. Wrap your app (or the subtree that uses Elaan) in it. All logic
 * lives in @elaanio/core; this is just wiring + Vue's provide/inject.
 */
export const ElaanProvider = defineComponent({
  name: "ElaanProvider",
  props: {
    /** The API base incl. version prefix, e.g. "https://api.elaan.io/v1". */
    apiBase: { type: String, required: true },
    /** Returns a short-lived contact token + id, minted by YOUR backend. */
    tokenProvider: {
      type: Function as PropType<TokenProvider>,
      required: true,
    },
    /** Realtime transport; defaults to fetch-SSE. Pass null for polling only. */
    realtime: {
      type: [Function, null] as PropType<RealtimeTransport | null>,
      default: undefined,
    },
    /** Inbox poll interval in ms (safety net alongside realtime). Default 30000. */
    pollInterval: { type: Number, default: undefined },
  },
  setup(props, { slots }) {
    const client = new ElaanClient(props.apiBase, () => props.tokenProvider());
    const realtime =
      props.realtime === undefined ? fetchStreamTransport : props.realtime;
    const inbox = createInboxStore(client, {
      realtime,
      pollInterval: props.pollInterval,
    });
    const preferences = createPreferencesStore(client);

    provide(ELAAN_KEY, { client, inbox, preferences });
    onScopeDispose(() => inbox.destroy());

    return () => slots.default?.();
  },
});

export function useElaanContext(): ElaanContext {
  const ctx = inject(ELAAN_KEY);
  if (!ctx) {
    throw new Error(
      "Elaan composables/components must be used within <ElaanProvider>.",
    );
  }
  return ctx;
}
