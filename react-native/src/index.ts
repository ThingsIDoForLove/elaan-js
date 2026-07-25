// The React binding is shared with @elaanio/react via @elaanio/react-core. RN gets
// the polling-only provider (no fetch-SSE transport — RN can't stream fetch).
export {
  ElaanProvider,
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "@elaanio/react-core";
export type { ElaanProviderProps } from "@elaanio/react-core";

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
