// Wire types — mirror the Elaan contact-facing API. No framework deps.

export type Channel = "email" | "inbox" | "push";

export type PushProvider = "fcm" | "apns" | "expo" | "onesignal" | "webpush";
export type Platform = "ios" | "android" | "web";

export interface ElaanNotification {
  id: string;
  notification_type_key: string;
  title: string;
  body: string;
  created_at: string; // ISO 8601
  read_at: string | null;
  is_read: boolean;
}

export interface ChannelPreference {
  channel: Channel;
  enabled: boolean; // effective on/off
  overridden: boolean; // the contact set an explicit choice
}

export interface TypePreference {
  notification_type_key: string;
  channels: ChannelPreference[];
}

/** The whole preference centre in one read: the contact's saved preferred
 * language (null = default) plus the notification-type × channel matrix. */
export interface ContactPreferences {
  language: string | null;
  types: TypePreference[];
}

// What the host app's token callback returns: a short-lived contact token minted
// by the app's OWN backend (POST /v1/contacts/tokens), plus the contact's id.
export interface ElaanToken {
  token: string;
  contactId: string;
}

export type TokenProvider = () => Promise<ElaanToken>;
