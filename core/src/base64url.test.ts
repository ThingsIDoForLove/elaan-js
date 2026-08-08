// These two functions are the reason browser push belongs in an SDK: both
// directions fail *silently* when wrong. A mangled applicationServerKey yields a
// subscription the push service accepts and the browser never surfaces; mangled
// auth/p256dh yield a payload the browser cannot decrypt and drops. Neither raises
// anywhere, so nothing but a test catches it.

import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url } from "./base64url";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("base64UrlToBytes", () => {
  it("decodes an unpadded string, which is how these keys are exchanged", () => {
    // "MWE" is base64 for the two bytes 0x31 0x61 (the ASCII of "1a"), and 3
    // base64 chars carry exactly 2 bytes — so this is the shortest input that
    // needs padding restored before atob will take it.
    expect(base64UrlToBytes("MWE")).toEqual(bytes(0x31, 0x61));
  });

  it("accepts padding when it is present", () => {
    expect(base64UrlToBytes("MWE=")).toEqual(base64UrlToBytes("MWE"));
  });

  // The whole point of base64URL over base64: `-` and `_` replace `+` and `/`,
  // and feeding the url alphabet straight to atob decodes to different bytes.
  it("maps the url alphabet, not the standard one", () => {
    const urlSafe = "-_8";
    expect(base64UrlToBytes(urlSafe)).toEqual(bytes(0xfb, 0xff));
  });

  it("round-trips a realistic 65-byte P-256 application server key", () => {
    // A VAPID public key is an uncompressed EC point: 0x04 plus two 32-byte
    // coordinates. The length matters — a short one is still a valid scalar, so a
    // truncating bug produces a key that "works" and never delivers.
    const key = new Uint8Array(65);
    key[0] = 0x04;
    for (let i = 1; i < 65; i += 1) key[i] = (i * 7) % 256;
    const encoded = bytesToBase64Url(key.buffer);
    expect(encoded).not.toContain("=");
    expect(base64UrlToBytes(encoded)).toEqual(key);
    expect(base64UrlToBytes(encoded).length).toBe(65);
  });
});

describe("bytesToBase64Url", () => {
  it("emits the url alphabet and strips padding", () => {
    const encoded = bytesToBase64Url(bytes(0xfb, 0xff).buffer);
    expect(encoded).toBe("-_8");
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns empty for a null key rather than throwing", () => {
    // `getKey()` is nullable in the DOM types, and a subscription missing a key is
    // a server-side validation error worth surfacing as such — not a crash inside
    // the SDK before the request is even made.
    expect(bytesToBase64Url(null)).toBe("");
  });

  it("round-trips the two subscription key sizes", () => {
    // auth is 16 bytes, p256dh is 65.
    for (const length of [16, 65]) {
      const key = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) key[i] = (i * 31 + 11) % 256;
      expect(base64UrlToBytes(bytesToBase64Url(key.buffer))).toEqual(key);
    }
  });

  it("handles a buffer large enough to break argument spreading", () => {
    // Not a real key size, but the chunked loop exists so this cannot become an
    // intermittent, size-dependent failure later. 100k is ~3 chunks at CHUNK
    // 0x8000, and well past the ~65k argument limit a spread would hit.
    const big = new Uint8Array(100_000);
    for (let i = 0; i < big.length; i += 1) big[i] = i % 256;
    const round = base64UrlToBytes(bytesToBase64Url(big.buffer));
    // Compared by hand rather than with toEqual: a deep-equal over 100k elements
    // takes seconds and made this the slowest test in the suite by 20x.
    expect(round.length).toBe(big.length);
    expect(round.every((byte, i) => byte === big[i])).toBe(true);
  });
});
