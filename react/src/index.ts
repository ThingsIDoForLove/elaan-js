export { ElaanProvider } from "./provider";
export type { ElaanProviderProps } from "./provider";

// The React binding (hooks) is shared with @elaan/react-native via @elaan/react-core.
export {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "@elaan/react-core";

// Web components.
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
