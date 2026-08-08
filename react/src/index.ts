export { ElaanProvider } from "./provider";
export type { ElaanProviderProps } from "./provider";

// The React binding (hooks) is shared with @elaanio/react-native via @elaanio/react-core.
export {
  useNotifications,
  useUnreadCount,
  usePreferences,
  usePush,
} from "@elaanio/react-core";

// `useBrowserPush` comes from react-core's *subpath*, not its main entry, and is
// exported here but NOT by @elaanio/react-native: it drives the browser's own Push
// API, which has no React Native equivalent (that platform uses `usePush` with an
// Expo or FCM token). The subpath split is what keeps a browser-only import out of
// the entry Metro has to bundle — see react-core/src/browser-push.ts.
//
// The result types come with it: `subscribe()` resolves to a discriminated result
// rather than throwing, so a consumer cannot handle it without being able to name
// it. Leaving them out sent the demo reaching past this package for a type.
export { useBrowserPush } from "@elaanio/react-core/web-push";
export type {
  BrowserPushResult,
  BrowserPushFailure,
} from "@elaanio/react-core/web-push";

// Since react pins react-core exact, changing either means republishing both.

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
