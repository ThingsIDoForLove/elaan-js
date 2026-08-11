import type { HTMLAttributes } from "react";
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

export interface NotificationFeedProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  emptyText?: string;
  onNotificationClick?: (n: ElaanNotification) => void;
}

/** The inbox list: unread markers, mark-read on click, mark-all-read, delete. */
export function NotificationFeed({
  emptyText = "You're all caught up.",
  onNotificationClick,
  className,
  ...rest
}: NotificationFeedProps) {
  const { notifications, loading, unreadCount, markRead, markAllRead, remove } =
    useNotifications();

  const open = (n: ElaanNotification) => {
    if (!n.is_read) void markRead(n.id);
    onNotificationClick?.(n);
  };

  return (
    <div
      {...rest}
      className={className ? `elaan-feed ${className}` : "elaan-feed"}
    >
      <div className="elaan-feed-head">
        <span className="elaan-feed-title">Notifications</span>
        {unreadCount > 0 && (
          <button
            type="button"
            className="elaan-link"
            onClick={() => void markAllRead()}
          >
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
              data-unread={n.is_read ? undefined : ""}
              onClick={() => open(n)}
            >
              <span className="elaan-unread-dot elaan-status" aria-hidden="true" />
              {/* The activatable region is the content, not the <li>: the
                  delete button is then a sibling of it rather than a button
                  nested inside something with a button role. A keydown on a
                  div does not synthesize a click, so this calls open() itself
                  and the <li>'s onClick still handles the mouse. */}
              <div
                className="elaan-item-main"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  open(n);
                }}
              >
                <div className="elaan-item-title">{n.title}</div>
                {n.body && <div className="elaan-item-body">{n.body}</div>}
                <div className="elaan-item-time">{timeAgo(n.created_at)}</div>
              </div>
              <button
                type="button"
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
