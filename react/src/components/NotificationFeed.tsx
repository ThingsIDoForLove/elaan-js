import { useNotifications } from "@elaanio/react-core";
import type { ElaanNotification } from "@elaanio/react-core";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface NotificationFeedProps {
  emptyText?: string;
  onNotificationClick?: (n: ElaanNotification) => void;
}

/** The inbox list: unread markers, mark-read on click, mark-all-read, delete. */
export function NotificationFeed({
  emptyText = "You're all caught up.",
  onNotificationClick,
}: NotificationFeedProps) {
  const { notifications, loading, unreadCount, markRead, markAllRead, remove } =
    useNotifications();

  return (
    <div className="elaan-feed">
      <div className="elaan-feed-head">
        <span className="elaan-feed-title">Notifications</span>
        {unreadCount > 0 && (
          <button className="elaan-link" onClick={() => void markAllRead()}>
            Mark all read
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="elaan-empty">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="elaan-empty">{emptyText}</div>
      ) : (
        <ul className="elaan-list">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={n.is_read ? "elaan-item" : "elaan-item elaan-unread"}
              onClick={() => {
                if (!n.is_read) void markRead(n.id);
                onNotificationClick?.(n);
              }}
            >
              <span className="elaan-status" aria-hidden="true" />
              <div className="elaan-item-main">
                <div className="elaan-item-title">{n.title}</div>
                {n.body && <div className="elaan-item-body">{n.body}</div>}
                <div className="elaan-item-time">{timeAgo(n.created_at)}</div>
              </div>
              <button
                className="elaan-item-del"
                aria-label="Delete notification"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(n.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
