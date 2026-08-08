export { ElaanProvider } from "./provider";
export type { ElaanProviderProps } from "./provider";

// The React binding (hooks) is shared with @elaanio/react-native via @elaanio/react-core.
//
// `useBrowserPush` is exported here but NOT by @elaanio/react-native: it drives
// the browser's own Push API, which has no React Native equivalent (that platform
// uses `usePush` with an Expo or FCM token). Since react pins react-core exact,
// adding a hook there means republishing both.
export {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
  useBrowserPush,
} from "@elaanio/react-core";

// Web components.
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
