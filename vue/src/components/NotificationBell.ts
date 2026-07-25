import { defineComponent, h, onBeforeUnmount, ref, type PropType } from "vue";
import type { ElaanNotification } from "@elaanio/core";
import { useUnreadCount } from "../composables";
import { NotificationFeed } from "./NotificationFeed";

/** A bell icon with an unread badge that opens a popover of the inbox feed. */
export const NotificationBell = defineComponent({
  name: "ElaanNotificationBell",
  props: {
    emptyText: { type: String, default: "You're all caught up." },
    onNotificationClick: {
      type: Function as PropType<(n: ElaanNotification) => void>,
      default: undefined,
    },
  },
  setup(props) {
    const unread = useUnreadCount();
    const open = ref(false);
    const wrap = ref<HTMLElement | null>(null);

    const onDoc = (e: MouseEvent) => {
      if (open.value && wrap.value && !wrap.value.contains(e.target as Node)) {
        open.value = false;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open.value = false;
    };
    if (typeof document !== "undefined") {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    onBeforeUnmount(() => {
      if (typeof document !== "undefined") {
        document.removeEventListener("mousedown", onDoc);
        document.removeEventListener("keydown", onKey);
      }
    });

    return () =>
      h("div", { class: "elaan-bell-wrap", ref: wrap }, [
        h(
          "button",
          {
            type: "button",
            class: "elaan-bell",
            "aria-label": "Notifications",
            "aria-expanded": String(open.value),
            onClick: () => (open.value = !open.value),
          },
          [
            h(
              "svg",
              {
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "aria-hidden": "true",
              },
              [
                h("path", {
                  d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9",
                }),
                h("path", { d: "M13.7 21a2 2 0 0 1-3.4 0" }),
              ],
            ),
            unread.value > 0
              ? h(
                  "span",
                  { class: "elaan-badge" },
                  unread.value > 99 ? "99+" : String(unread.value),
                )
              : null,
          ],
        ),
        open.value
          ? h(
              "div",
              {
                class: "elaan-popover",
                role: "dialog",
                "aria-label": "Notifications",
              },
              [
                h(NotificationFeed, {
                  emptyText: props.emptyText,
                  onNotificationClick: props.onNotificationClick,
                }),
              ],
            )
          : null,
      ]);
  },
});
