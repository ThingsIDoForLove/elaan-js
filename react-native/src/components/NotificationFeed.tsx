import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNotifications, type ElaanNotification } from "@elaanio/react-core";
import { colors, timeAgo } from "../theme";

export interface NotificationFeedProps {
  emptyText?: string;
  onNotificationPress?: (n: ElaanNotification) => void;
}

/** The inbox list (RN): mark-read on press, mark-all-read, delete. */
export function NotificationFeed({
  emptyText = "You're all caught up.",
  onNotificationPress,
}: NotificationFeedProps) {
  const { notifications, loading, unreadCount, markRead, markAllRead, remove } =
    useNotifications();

  return (
    <View style={styles.feed}>
      <View style={styles.head}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={() => void markAllRead()}>
            <Text style={styles.link}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={styles.center} />
      ) : notifications.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              onPress={() => {
                if (!item.is_read) void markRead(item.id);
                onNotificationPress?.(item);
              }}
            >
              <View style={[styles.dot, !item.is_read && styles.dotUnread]} />
              <View style={styles.itemMain}>
                <Text
                  style={[styles.itemTitle, !item.is_read && styles.itemTitleBold]}
                >
                  {item.title}
                </Text>
                {!!item.body && <Text style={styles.itemBody}>{item.body}</Text>}
                <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => void remove(item.id)}>
                <Text style={styles.del}>×</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { backgroundColor: colors.bg },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontWeight: "600", fontSize: 15, color: colors.text },
  link: { color: colors.accent, fontSize: 13 },
  center: { padding: 32 },
  empty: { padding: 32, textAlign: "center", color: colors.muted },
  item: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: "transparent",
  },
  dotUnread: { backgroundColor: colors.accent },
  itemMain: { flex: 1 },
  itemTitle: { color: colors.text, fontWeight: "500" },
  itemTitleBold: { fontWeight: "700" },
  itemBody: { color: colors.muted, fontSize: 13, marginTop: 2 },
  itemTime: { color: colors.muted, fontSize: 11, marginTop: 4 },
  del: { color: colors.muted, fontSize: 18, paddingHorizontal: 4 },
});
