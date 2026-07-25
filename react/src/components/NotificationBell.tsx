import { useEffect, useRef, useState } from "react";
import { useUnreadCount } from "@elaanio/react-core";
import { NotificationFeed, type NotificationFeedProps } from "./NotificationFeed";

export interface NotificationBellProps extends NotificationFeedProps {}

/** A bell icon with an unread badge that opens a popover of the inbox feed. */
export function NotificationBell(props: NotificationBellProps) {
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="elaan-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="elaan-bell"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="elaan-badge">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="elaan-popover" role="dialog" aria-label="Notifications">
          <NotificationFeed {...props} />
        </div>
      )}
    </div>
  );
}
