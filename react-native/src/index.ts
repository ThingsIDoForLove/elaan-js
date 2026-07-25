// The React binding is shared with @elaanio/react via @elaanio/react-core. The RN
// provider wires in an SSE transport backed by react-native-sse (browser fetch
// can't stream in RN), falling back to polling when realtime is unavailable.
export { ElaanProvider } from "./provider";
export type { ElaanProviderProps } from "./provider";
export { reactNativeSseTransport } from "./realtime";
export {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "@elaanio/react-core";

// React Native components.
export { NotificationBell } from "./components/NotificationBell";
export type { NotificationBellProps } from "./components/NotificationBell";
export { NotificationFeed } from "./components/NotificationFeed";
export type { NotificationFeedProps } from "./components/NotificationFeed";
export { Preferences } from "./components/Preferences";
export type { PreferencesProps } from "./components/Preferences";

export { ElaanClient, ElaanError } from "@elaanio/core";
export type {
  Channel,
  PushProvider,
  Platform,
  ElaanNotification,
  ChannelPreference,
  TypePreference,
  ElaanToken,
  TokenProvider,
} from "@elaanio/core";
