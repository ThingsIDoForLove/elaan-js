export { ElaanProvider, useElaanContext } from "./context";
export type { ElaanProviderProps } from "./context";
export {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "./hooks";

// Re-export the core types + values consumers commonly need, so a framework
// package can depend on just @elaanio/react-core.
export {
  ElaanClient,
  ElaanError,
  fetchStreamTransport,
  type RealtimeTransport,
  type Channel,
  type PushProvider,
  type Platform,
  type ElaanNotification,
  type ChannelPreference,
  type TypePreference,
  type ElaanToken,
  type TokenProvider,
} from "@elaanio/core";
