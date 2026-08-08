import { useState } from "react";
import {
  Preferences,
  useBrowserPush,
  useNotifications,
  type BrowserPushResult,
} from "@elaanio/react";
import { CONTACT_EXTERNAL_ID, configured } from "./config";

// Served from the origin root, so its scope covers the whole app. Built from
// src/sw.ts by `pnpm build:sw`, which `dev` and `build` run first.
const SERVICE_WORKER_URL = "/sw.js";

/** Turn a subscribe result into something a person can act on.
 *
 * The interesting one is `denied`: it is not recoverable in code. The browser will
 * not prompt again, so the only way forward is site settings — and an app that
 * shows "try again" here just wastes the user's time.
 */
function explain(result: BrowserPushResult): string {
  if (result.ok) {
    return result.renewed
      ? "Subscribed. The previous subscription was replaced because the account's VAPID key had changed."
      : "Subscribed. Trigger a notification to see it arrive.";
  }
  switch (result.reason) {
    case "unsupported":
      return "This browser can't do push, or the page isn't on a secure origin (localhost counts, plain http:// doesn't).";
    case "denied":
      return "Notifications are blocked for this site. The browser won't ask again — change it in site settings.";
    case "dismissed":
      return "The prompt was dismissed. Asking again later is fine.";
    case "not-configured":
      return "This account has no Web Push transport. Add VAPID keys under Push Transport in the console.";
  }
}

export function App() {
  const push = useBrowserPush({ serviceWorkerUrl: SERVICE_WORKER_URL });
  const { notifications, unreadCount } = useNotifications();
  const [message, setMessage] = useState<string | null>(null);

  if (!configured) {
    return (
      <main>
        <h1>Elaan browser push demo</h1>
        <p className="warn">
          Copy <code>.env.example</code> to <code>.env.local</code> and set{" "}
          <code>ELAAN_TENANT_KEY</code>. The dev server uses it to mint contact
          tokens; the browser never sees it.
        </p>
      </main>
    );
  }

  const onSubscribe = async () => {
    try {
      setMessage(explain(await push.subscribe()));
    } catch (error) {
      setMessage(`Failed: ${(error as Error).message}`);
    }
  };

  const onUnsubscribe = async () => {
    try {
      const removed = await push.unsubscribe();
      setMessage(
        removed
          ? "Unsubscribed."
          : "Nothing to remove — this browser has no subscription and none was recorded.",
      );
    } catch (error) {
      setMessage(`Failed: ${(error as Error).message}`);
    }
  };

  return (
    <main>
      <h1>Elaan browser push demo</h1>
      <p className="muted">
        Acting as contact <code>{CONTACT_EXTERNAL_ID}</code>
      </p>

      <section>
        <h2>This browser</h2>
        <dl>
          <dt>Push support</dt>
          <dd>{push.supported ? "yes" : "no"}</dd>
          <dt>Permission</dt>
          <dd>{push.permission}</dd>
          <dt>Subscribed</dt>
          {/* `checked` distinguishes "not subscribed" from "haven't looked yet",
              so a subscribed user doesn't see a flash of Off on load. */}
          <dd>{!push.checked ? "checking…" : push.subscribed ? "yes" : "no"}</dd>
        </dl>
        {push.endpoint && (
          <p className="endpoint">
            <strong>Endpoint</strong>
            <br />
            {push.endpoint}
          </p>
        )}
        <div className="row">
          <button
            onClick={onSubscribe}
            disabled={push.busy || !push.supported || push.subscribed}
          >
            {push.busy ? "Working…" : "Subscribe"}
          </button>
          <button
            onClick={onUnsubscribe}
            disabled={push.busy || !push.subscribed}
          >
            Unsubscribe
          </button>
        </div>
        {message && <p className="message">{message}</p>}
        {push.error && <p className="warn">{push.error.message}</p>}
      </section>

      <section>
        <h2>Preferences</h2>
        <p className="muted">
          A row per notification type. “Browser push” only appears for a type
          that has a web push template — the API omits channels it could never
          deliver on.
        </p>
        <Preferences />
      </section>

      <section>
        <h2>Inbox ({unreadCount} unread)</h2>
        <p className="muted">
          Here to show the same trigger reaching two channels: a browser
          notification and a stored inbox row.
        </p>
        {notifications.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <br />
                {n.body}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
