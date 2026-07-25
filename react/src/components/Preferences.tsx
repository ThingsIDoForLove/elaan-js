import { usePreferences } from "@elaan/react-core";
import type { Channel } from "@elaan/react-core";

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  inbox: "In-app",
  push: "Push",
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
