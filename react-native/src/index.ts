// The React binding is shared with @elaan/react via @elaan/react-core. RN gets
// the polling-only provider (no fetch-SSE transport — RN can't stream fetch).
export {
  ElaanProvider,
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "@elaan/react-core";
export type { ElaanProviderProps } from "@elaan/react-core";

// React Native components.
export { NotificationBell } from "./components/NotificationBell";
export type { NotificationBellProps } from "./components/NotificationBell";
export { NotificationFeed } from "./components/NotificationFeed";
export type { NotificationFeedProps } from "./components/NotificationFeed";
export { Preferences } from "./components/Preferences";
export type { PreferencesProps } from "./components/Preferences";

export { ElaanClient, ElaanError } from "@elaan/core";
export type {
  Channel,
  PushProvider,
  Platform,
  ElaanNotification,
  ChannelPreference,
  TypePreference,
  ElaanToken,
  TokenProvider,
} from "@elaan/core";
