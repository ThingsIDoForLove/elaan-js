import { defineComponent, h, type PropType, type VNode } from "vue";
import type { ElaanNotification } from "@elaanio/core";
import { useNotifications } from "../composables";
import { timeAgo } from "../time";

/** The inbox list: unread markers, mark-read on click, mark-all-read, delete. */
export const NotificationFeed = defineComponent({
  name: "ElaanNotificationFeed",
  props: {
    emptyText: { type: String, default: "You're all caught up." },
    onNotificationClick: {
      type: Function as PropType<(n: ElaanNotification) => void>,
      default: undefined,
    },
  },
  setup(props) {
    const { notifications, loading, unreadCount, markRead, markAllRead, remove } =
      useNotifications();

    const open = (n: ElaanNotification) => {
      if (!n.is_read) void markRead(n.id);
      props.onNotificationClick?.(n);
    };

    return () => {
      const head = h("div", { class: "elaan-feed-head" }, [
        h("span", { class: "elaan-feed-title" }, "Notifications"),
        unreadCount.value > 0
          ? h(
              "button",
              {
                type: "button",
                class: "elaan-link",
                onClick: () => void markAllRead(),
              },
              "Mark all read",
            )
          : null,
      ]);

      let body: VNode;
      if (loading.value && notifications.value.length === 0) {
        body = h("div", { class: "elaan-empty" }, "Loading…");
      } else if (notifications.value.length === 0) {
        body = h("div", { class: "elaan-empty" }, props.emptyText);
      } else {
        body = h(
          "ul",
          { class: "elaan-list" },
          notifications.value.map((n) =>
            h(
              "li",
              {
                key: n.id,
                class: n.is_read ? "elaan-item" : "elaan-item elaan-unread",
                "data-unread": n.is_read ? undefined : "",
                onClick: () => open(n),
              },
              [
                h("span", {
                  class: "elaan-unread-dot elaan-status",
                  "aria-hidden": "true",
                }),
                // The activatable region is the content, so the delete button
                // is its sibling rather than a button nested inside something
                // with a button role. A keydown on a div does not synthesize a
                // click, so this calls open() itself.
                h(
                  "div",
                  {
                    class: "elaan-item-main",
                    role: "button",
                    tabindex: 0,
                    onKeydown: (e: KeyboardEvent) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      open(n);
                    },
                  },
                  [
                    h("div", { class: "elaan-item-title" }, n.title),
                    n.body ? h("div", { class: "elaan-item-body" }, n.body) : null,
                    h("div", { class: "elaan-item-time" }, timeAgo(n.created_at)),
                  ],
                ),
                h(
                  "button",
                  {
                    type: "button",
                    class: "elaan-item-del",
                    "aria-label": "Delete notification",
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation();
                      void remove(n.id);
                    },
                  },
                  "×",
                ),
              ],
            ),
          ),
        );
      }

      return h("div", { class: "elaan-feed" }, [head, body]);
    };
  },
});
