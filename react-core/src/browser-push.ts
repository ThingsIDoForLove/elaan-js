// `useBrowserPush`, in its own entry point.
//
// Not in `hooks.ts`, because that is react-core's MAIN entry and
// `@elaanio/react-native` imports it. This module imports `@elaanio/core/web-push`
// — a package `exports` subpath — and Metro only honours those with
// `unstable_enablePackageExports`, off by default before Metro 0.82 / RN 0.79.
// React Native >=0.71 is the range react-native declares, so a bare
// `@elaanio/core/web-push` in the main entry fails to resolve and breaks the bundle
// for an app that never touches browser push. Splitting it here mirrors why `core`
// itself is split three ways.
//
// Reached as `@elaanio/react-core/web-push`, or via `@elaanio/react`, which is
// web-only and re-exports it.

import { useCallback, useEffect, useState } from "react";
import {
  browserPushPermission,
  browserPushSupported,
  currentBrowserSubscription,
  subscribeToBrowserPush,
  unsubscribeFromBrowserPush,
  type BrowserPushResult,
} from "@elaanio/core/web-push";
import { useElaanContext } from "./context";

export type { BrowserPushResult, BrowserPushFailure } from "@elaanio/core/web-push";

/**
 * Browser push (the `web_push` channel) as a piece of UI state.
 *
 * Unlike `usePush` this owns the whole handshake — permission, service worker,
 * subscribe, key conversion — because there is nothing for the app to pass in.
 * What it gives back is what a toggle needs to render honestly: whether the
 * browser can do this at all, whether the user has already refused, and whether
 * this browser is currently subscribed.
 *
 * `subscribe()` resolves to a discriminated result rather than throwing, because
 * "unsupported" and "denied" are ordinary states to render, not errors. Genuine
 * faults (the API unreachable) land in `error`.
 *
 * Browser-only. It imports `@elaanio/core/web-push`, so do not call it from React
 * Native — `usePush` is that platform's path.
 */
export function useBrowserPush(options: {
  serviceWorkerUrl: string;
  /** Registration scope, if your worker isn't at the origin root. Must match what
   *  you pass elsewhere, or the reads below resolve a different registration. */
  scope?: string;
}) {
  const { serviceWorkerUrl, scope } = options;
  const { client } = useElaanContext();
  // `false` / `"unsupported"` initially rather than reading `navigator` during
  // render: this hook is imported by apps that server-render (Next.js), where those
  // globals are absent and a render-time read is a hydration mismatch. The effect
  // below replaces both on the client's first pass, which is also when `checked`
  // becomes true.
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Set once the first check has run, so a UI can tell "not subscribed" from
  // "don't know yet" and avoid flashing an Off toggle for a subscribed user.
  const [checked, setChecked] = useState(false);

  // Read the *browser's* view of the subscription, which is the authority on
  // whether a push can still arrive here — the server's row can outlive a
  // subscription the user revoked in site settings.
  useEffect(() => {
    const canPush = browserPushSupported();
    setSupported(canPush);
    setPermission(browserPushPermission());
    if (!canPush) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    // The configured worker, not whatever matches the current page URL. Without
    // these arguments a worker outside the page's scope reads as "not subscribed",
    // and a host app's own root-scoped worker reads as ours.
    currentBrowserSubscription(serviceWorkerUrl, scope)
      .then((subscription) => {
        if (cancelled) return;
        setEndpoint(subscription?.endpoint ?? null);
      })
      .catch(() => {
        /* no registration yet is the normal cold state, not an error */
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceWorkerUrl, scope]);

  const subscribe = useCallback(async (): Promise<BrowserPushResult> => {
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeToBrowserPush({
        client,
        serviceWorkerUrl,
        scope,
      });
      if (result.ok) setEndpoint(result.endpoint);
      return result;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      throw failure;
    } finally {
      // In `finally`, so a fault after the prompt still reflects what the user
      // answered — otherwise `permission` freezes at its pre-prompt value and the
      // toggle offers to ask again for something already granted or refused.
      setPermission(browserPushPermission());
      setBusy(false);
    }
  }, [client, serviceWorkerUrl, scope]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const removed = await unsubscribeFromBrowserPush({
        client,
        serviceWorkerUrl,
        scope,
      });
      // Only when something actually went. Nulling unconditionally reported "off"
      // for a browser whose subscription was untouched and still being delivered
      // to — and left no way back, since a UI naturally disables Unsubscribe on
      // `!subscribed`.
      if (removed) setEndpoint(null);
      return removed;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      throw failure;
    } finally {
      setBusy(false);
    }
  }, [client, serviceWorkerUrl, scope]);

  return {
    supported,
    permission,
    /** Null until the first check completes — see `checked`. */
    endpoint,
    subscribed: endpoint !== null,
    checked,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}
