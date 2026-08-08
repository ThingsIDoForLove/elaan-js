import { usePreferences } from "@elaanio/react-core";
import type { Channel } from "@elaanio/react-core";

// Both push channels say which surface they mean. "Push" alone was unambiguous
// until browsers arrived; a contact who has the app AND the site has no other way
// to tell the two toggles apart, and they are separate channels precisely so the
// two can be set independently.
const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  inbox: "In-app",
  push: "Mobile push",
  web_push: "Browser push",
};

export interface PreferencesProps {
  /** Map a notification-type key to a friendly label (defaults to the key). */
  typeLabel?: (notificationTypeKey: string) => string;
}

/** A preference matrix: one row per notification type, a toggle per channel. */
export function Preferences({ typeLabel }: PreferencesProps) {
  const { preferences, loading, setPreference } = usePreferences();

  if (loading && preferences.length === 0) {
    return <div className="elaan-empty">Loading…</div>;
  }
  if (preferences.length === 0) {
    return <div className="elaan-empty">No notification types yet.</div>;
  }

  return (
    <div className="elaan-prefs">
      {preferences.map((tp) => (
        <div className="elaan-pref-row" key={tp.notification_type_key}>
          <div className="elaan-pref-type">
            {typeLabel ? typeLabel(tp.notification_type_key) : tp.notification_type_key}
          </div>
          <div className="elaan-pref-channels">
            {tp.channels.map((c) => (
              <label className="elaan-toggle" key={c.channel}>
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) =>
                    void setPreference(
                      tp.notification_type_key,
                      c.channel,
                      e.target.checked,
                    )
                  }
                />
                <span>{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
