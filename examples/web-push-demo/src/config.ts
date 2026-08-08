// Where the demo gets its contact token.
//
// The token is minted by a server, not here — see the `/elaan-token` proxy in
// vite.config.ts, which stands in for YOUR backend. That is not tidiness: the
// mint endpoint takes a tenant API key that can read and write every contact in
// the account, and the API deliberately keeps it out of the wildcard-CORS set so
// a browser on an arbitrary origin cannot reach it. Minting from the page is the
// first thing this demo tried, and the browser blocked it.
//
// Everything the SDK calls afterwards — preferences, inbox, push subscriptions,
// the VAPID public key — is contact-facing, allows any origin, and is called
// directly from the browser with the short-lived contact token. Same shape you
// would ship.

declare const __ELAAN_API_BASE__: string;
declare const __ELAAN_CONTACT__: string;
declare const __ELAAN_CONFIGURED__: boolean;

export const API_BASE = __ELAAN_API_BASE__;

/** Which contact to act as — its `external_id` in your own system. */
export const CONTACT_EXTERNAL_ID = __ELAAN_CONTACT__;

/** Whether the dev server has a tenant key to mint with. */
export const configured = __ELAAN_CONFIGURED__;

/** Stand-in for your backend's token endpoint. */
export async function mintContactToken(): Promise<{
  token: string;
  contactId: string;
}> {
  const response = await fetch("/elaan-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ external_id: CONTACT_EXTERNAL_ID }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? `No contact with external_id "${CONTACT_EXTERNAL_ID}". Create it first — ` +
          `contact creation is tenant-only, so the demo can't.`
        : `Couldn't mint a contact token (${response.status}). Is ELAAN_TENANT_KEY ` +
          `set in .env.local, and is the API running?`,
    );
  }
  const body = await response.json();
  return { token: body.token, contactId: body.contact_id };
}
