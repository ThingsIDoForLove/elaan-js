import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useUnreadCount } from "@elaan/react-core";
import { colors } from "../theme";
import { NotificationFeed, type NotificationFeedProps } from "./NotificationFeed";

export interface NotificationBellProps extends NotificationFeedProps {}

/** A bell with an unread badge; tapping opens the inbox feed in a modal card. */
export function NotificationBell(props: NotificationBellProps) {
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        style={styles.bell}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => setOpen(true)}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <NotificationFeed {...props} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: { fontSize: 20 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.accentInk, fontSize: 10, fontWeight: "700" },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    paddingTop: 80,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    overflow: "hidden",
    maxHeight: "80%",
  },
});
