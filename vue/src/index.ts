export { ElaanProvider, useElaanContext } from "./context";
export type { ElaanContext } from "./context";
export {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "./composables";
export { NotificationBell } from "./components/NotificationBell";
export { NotificationFeed } from "./components/NotificationFeed";
export { Preferences } from "./components/Preferences";

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
} from "@elaanio/core";
