import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Not `VITE_`-prefixed on purpose: a `VITE_` variable is inlined into the
  // client bundle, and this is a tenant API key. Read here, in the dev server,
  // so it never reaches the browser.
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.ELAAN_API_BASE || "http://localhost:8000/v1";

  return {
    plugins: [react()],
    server: {
      // A service worker needs a secure context. `localhost` counts, so this works
      // over plain http — a LAN address or an http:// staging host does not, and
      // `navigator.serviceWorker` is simply absent there.
      port: 5180,
      strictPort: true,
      proxy: {
        // This proxy stands in for YOUR BACKEND, and the demo needs one for a
        // real reason rather than for convenience.
        //
        // `POST /v1/contacts/tokens` is tenant-only, so it is deliberately NOT in
        // the API's wildcard-CORS set — a browser on an arbitrary origin cannot
        // call it, and shouldn't be able to: it takes a tenant key that can read
        // and write every contact in the account. Minting from the page was the
        // first thing this demo tried and the browser blocked it outright.
        //
        // Everything the SDK itself calls — preferences, inbox, push
        // subscriptions, the VAPID public key — IS contact-facing and works
        // cross-origin with a contact token. So this proxy covers exactly the one
        // step that belongs on a server, which is also the production topology.
        "/elaan-token": {
          target: apiBase,
          changeOrigin: true,
          rewrite: () => "/contacts/tokens",
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (env.ELAAN_TENANT_KEY) {
                proxyReq.setHeader(
                  "Authorization",
                  `Bearer ${env.ELAAN_TENANT_KEY}`,
                );
              }
            });
          },
        },
      },
    },
    define: {
      // The API base the *SDK* talks to directly. Not a secret.
      __ELAAN_API_BASE__: JSON.stringify(apiBase),
      __ELAAN_CONTACT__: JSON.stringify(
        env.ELAAN_CONTACT_EXTERNAL_ID || "demo-contact",
      ),
      __ELAAN_CONFIGURED__: JSON.stringify(Boolean(env.ELAAN_TENANT_KEY)),
    },
  };
});
