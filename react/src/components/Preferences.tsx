import type { HTMLAttributes } from "react";
import { usePreferences } from "@elaanio/react-core";
import type { Channel } from "@elaanio/react-core";

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  inbox: "In-app",
  push: "Push",
};

export interface PreferencesProps extends HTMLAttributes<HTMLDivElement> {
  /** Map a notification-type key to a friendly label (defaults to the key). */
  typeLabel?: (notificationTypeKey: string) => string;
}

/** A preference matrix: one row per notification type, a toggle per channel. */
export function Preferences({
  typeLabel,
  className,
  ...rest
}: PreferencesProps) {
  const { preferences, loading, setPreference } = usePreferences();
  const root = {
    ...rest,
    className: className ? `elaan-prefs ${className}` : "elaan-prefs",
  };

  // The loading and empty states carry the same root as the matrix. They used
  // to render a bare `.elaan-empty`, so a scoped theme (and the component's
  // own font and colour) applied to every state except the first one a reader
  // sees.
  if (loading && preferences.length === 0) {
    return (
      <div {...root}>
        <div className="elaan-empty">Loading…</div>
      </div>
    );
  }
  if (preferences.length === 0) {
    return (
      <div {...root}>
        <div className="elaan-empty">No notification types yet.</div>
      </div>
    );
  }

  return (
    <div {...root}>
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
