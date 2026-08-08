// Pins the wire shape, because getting it wrong is invisible.
//
// The first version of `unpackPush` read `_icon`/`_badge`/`_url` from inside
// `data` — the encoding the delivery *outbox* uses, since its row is
// channel-agnostic and three columns for one channel weren't worth it. The sender
// unpacks them back out before transmitting, so a worker reading the storage form
// finds nothing: notifications showed with the browser's default icon and every
// click was a no-op. Nothing failed, nothing logged. Hence these.
//
// The fixtures below are the sender's output shape (`web_push_sender.py`:
// `message = dict(options)` then title/body/data), not the outbox row's.

import { describe, expect, it } from "vitest";
import { unpackPush } from "./service-worker";

describe("unpackPush", () => {
  it("reads icon, badge and url from the top level", () => {
    const { title, options, url } = unpackPush({
      title: "Order A-1 shipped",
      body: "On its way.",
      icon: "https://cdn.test/icon.png",
      badge: "https://cdn.test/badge.png",
      url: "https://app.test/orders/A-1",
      data: { order_id: "A-1" },
    });
    expect(title).toBe("Order A-1 shipped");
    expect(options.body).toBe("On its way.");
    expect(options.icon).toBe("https://cdn.test/icon.png");
    expect(options.badge).toBe("https://cdn.test/badge.png");
    expect(url).toBe("https://app.test/orders/A-1");
  });

  // The regression, stated directly: the storage form must NOT be mistaken for the
  // wire form. If someone "restores" the old reading, this fails.
  it("does not treat the outbox's _-prefixed storage keys as options", () => {
    const { options, url } = unpackPush({
      title: "t",
      data: { _icon: "https://cdn.test/i.png", _url: "https://app.test/x" },
    });
    expect(options.icon).toBeUndefined();
    expect(url).toBeNull();
  });

  it("carries the tenant's data through, plus the url for the click handler", () => {
    const { options } = unpackPush({
      title: "t",
      url: "https://app.test/x",
      data: { order_id: "A-1" },
    });
    // `data` is the only thing that survives to `notificationclick`.
    expect(options.data).toEqual({ order_id: "A-1", _url: "https://app.test/x" });
  });

  it("omits the url key entirely when the template set none", () => {
    expect(unpackPush({ title: "t", data: { a: "1" } }).options.data).toEqual({
      a: "1",
    });
  });

  // The sender omits any field that rendered empty, so every one is optional.
  it("survives a payload with nothing but a title", () => {
    const { title, options, url } = unpackPush({ title: "t" });
    expect(title).toBe("t");
    expect(options.body).toBe("");
    expect(options.icon).toBeUndefined();
    expect(options.data).toEqual({});
    expect(url).toBeNull();
  });

  // A worker that shows nothing gets the browser's own "site has been updated in
  // the background" notice, which is worse than a generic title.
  it("falls back to a title rather than showing nothing", () => {
    expect(unpackPush({}).title).toBe("Notification");
    expect(unpackPush({ title: "" }).title).toBe("Notification");
  });
});
