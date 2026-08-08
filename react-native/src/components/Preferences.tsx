import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { usePreferences, type Channel } from "@elaanio/react-core";
import { colors } from "../theme";

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
  typeLabel?: (notificationTypeKey: string) => string;
}

/** A preference matrix (RN): one row per type, a Switch per channel. */
export function Preferences({ typeLabel }: PreferencesProps) {
  const { preferences, loading, setPreference } = usePreferences();

  if (loading && preferences.length === 0) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />;
  }
  if (preferences.length === 0) {
    return <Text style={styles.empty}>No notification types yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {preferences.map((tp) => (
        <View style={styles.row} key={tp.notification_type_key}>
          <Text style={styles.type}>
            {typeLabel
              ? typeLabel(tp.notification_type_key)
              : tp.notification_type_key}
          </Text>
          <View style={styles.channels}>
            {tp.channels.map((c) => (
              <View style={styles.toggle} key={c.channel}>
                <Text style={styles.channelLabel}>
                  {CHANNEL_LABELS[c.channel] ?? c.channel}
                </Text>
                <Switch
                  value={c.enabled}
                  onValueChange={(v) =>
                    void setPreference(tp.notification_type_key, c.channel, v)
                  }
                  trackColor={{ true: colors.accent }}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 32 },
  empty: { padding: 32, textAlign: "center", color: colors.muted },
  list: { gap: 8 },
  row: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
  },
  type: { fontWeight: "600", color: colors.text, marginBottom: 8 },
  channels: { gap: 8 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  channelLabel: { color: colors.muted },
});
