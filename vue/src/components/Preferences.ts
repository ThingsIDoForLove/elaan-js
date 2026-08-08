import { defineComponent, h, type PropType } from "vue";
import type { Channel } from "@elaanio/core";
import { usePreferences } from "../composables";

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

/** A preference matrix: one row per notification type, a toggle per channel. */
export const Preferences = defineComponent({
  name: "ElaanPreferences",
  props: {
    /** Map a notification-type key to a friendly label (defaults to the key). */
    typeLabel: {
      type: Function as PropType<(notificationTypeKey: string) => string>,
      default: undefined,
    },
  },
  setup(props) {
    const { preferences, loading, setPreference } = usePreferences();

    return () => {
      if (loading.value && preferences.value.length === 0) {
        return h("div", { class: "elaan-empty" }, "Loading…");
      }
      if (preferences.value.length === 0) {
        return h("div", { class: "elaan-empty" }, "No notification types yet.");
      }
      return h(
        "div",
        { class: "elaan-prefs" },
        preferences.value.map((tp) =>
          h("div", { class: "elaan-pref-row", key: tp.notification_type_key }, [
            h(
              "div",
              { class: "elaan-pref-type" },
              props.typeLabel
                ? props.typeLabel(tp.notification_type_key)
                : tp.notification_type_key,
            ),
            h(
              "div",
              { class: "elaan-pref-channels" },
              tp.channels.map((c) =>
                h("label", { class: "elaan-toggle", key: c.channel }, [
                  h("input", {
                    type: "checkbox",
                    checked: c.enabled,
                    onChange: (e: Event) =>
                      void setPreference(
                        tp.notification_type_key,
                        c.channel,
                        (e.target as HTMLInputElement).checked,
                      ),
                  }),
                  h("span", CHANNEL_LABELS[c.channel] ?? c.channel),
                ]),
              ),
            ),
          ]),
        ),
      );
    };
  },
});
