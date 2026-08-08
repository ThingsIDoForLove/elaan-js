// base64url ⇄ bytes, for the two places the Web Push handshake needs it.
//
// This is small and it is where hand-rolled browser-push code goes wrong, which
// is most of the reason this SDK is worth having. Both directions fail *silently*
// when they are wrong: a mangled `applicationServerKey` produces a subscription
// the push service accepts and the browser never surfaces, and mangled
// `auth`/`p256dh` produce a payload the browser cannot decrypt and drops without
// an error anywhere. Neither shows up as an exception — only as "no notification
// arrived", which is unhelpfully identical to a dozen other causes.
//
// Web Push uses base64**url** (RFC 4648 §5: `-` and `_`, padding optional), while
// `atob`/`btoa` speak standard base64. Converting between the two alphabets is
// the whole job.

/** Decode a base64url string to bytes.
 *
 * Used for the VAPID public key, which `pushManager.subscribe()` wants as a
 * `BufferSource` and the API returns as a string. Padding is restored because
 * `atob` requires it while the servers that mint these keys usually strip it.
 */
export function base64UrlToBytes(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Encode bytes as an unpadded base64url string.
 *
 * Used for the two subscription keys, which the browser hands over as raw
 * `ArrayBuffer`s from `getKey()`. Unpadded because that is what the Web Push
 * ecosystem exchanges, and what the API stores.
 */
export function bytesToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  // Chunked rather than `String.fromCharCode(...bytes)`: spreading a large array
  // into arguments can blow the call-stack limit. These two keys are small, but
  // the failure would be intermittent and by size, which is a bad way to find out.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
