// Wire types — mirror the Elaan contact-facing API. No framework deps.

/** A delivery channel.
 *
 * `push` is a *mobile* push (Expo, FCM, APNs) and `web_push` is a browser
 * notification — separate channels, not one channel with two providers, because
 * a contact's opt-out is keyed by (type, channel): sharing one would make "no
 * browser nags, keep my phone alerts" inexpressible. They also read different
 * halves of `push_subscriptions`, partitioned by provider.
 *
 * `web_push` was missing here while the API already returned it from
 * `GET /v1/contacts/{id}/preferences`, so the type contradicted the wire and a
 * consumer could not name the channel it was being told about. */
export type Channel = "email" | "inbox" | "push" | "web_push";

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
