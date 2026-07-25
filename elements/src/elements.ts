import type { ElaanNotification, TypePreference } from "@elaanio/core";
import {
  getElaanController,
  onControllerChange,
  type ElaanController,
} from "./controller";
import { applyStyles } from "./styles";

/**
 * `HTMLElement` doesn't exist in Node, and a bare `class X extends HTMLElement`
 * is evaluated at module load — so importing this package from an SSR bundle
 * (Next.js, Nuxt, SvelteKit, Astro…) would throw before any guard could run.
 * Falling back to an inert stub keeps the import side-effect-free on the server;
 * the classes are never constructed there because `defineElaanElements()` no-ops
 * without a custom element registry.
 */
const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

const DEFAULT_EMPTY_TEXT = "You're all caught up.";

// Static markup, no interpolation — safe to assign as a string.
const BELL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** Assign only when it actually changed — avoids needless layout/paint work. */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Shared base: owns the shadow root, styles, and controller/store binding. */
abstract class ElaanElement extends HTMLElementBase {
  protected container: HTMLDivElement;
  private offController?: () => void;
  private offStore?: () => void;
  private started = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    applyStyles(root);
    this.container = document.createElement("div");
    root.appendChild(this.container);
  }

  connectedCallback(): void {
    if (!this.started) {
      this.init();
      this.started = true;
    }
    this.offController = onControllerChange(() => this.rebind());
    this.rebind();
  }

  disconnectedCallback(): void {
    this.offController?.();
    this.offController = undefined;
    this.offStore?.();
    this.offStore = undefined;
  }

  attributeChangedCallback(): void {
    if (this.started) this.render();
  }

  private rebind(): void {
    this.offStore?.();
    this.offStore = undefined;
    const c = getElaanController();
    if (c) this.offStore = this.subscribe(c);
    this.render();
  }

  /** One-time setup: build the DOM skeleton + delegated listeners. */
  protected abstract init(): void;
  /** Subscribe to the store this element renders; return an unsubscribe. */
  protected abstract subscribe(c: ElaanController): () => void;
  /** Patch the existing DOM in place. Never replaces the skeleton. */
  protected abstract render(): void;
}

interface FeedItem {
  li: HTMLLIElement;
  title: HTMLDivElement;
  body: HTMLDivElement;
  time: HTMLDivElement;
}

/** `<elaan-feed>` — the inbox list: mark-read on click, mark-all-read, delete. */
export class ElaanFeedElement extends ElaanElement {
  static observedAttributes = ["empty-text"];

  private markAllBtn!: HTMLButtonElement;
  private list!: HTMLUListElement;
  private status!: HTMLDivElement;
  private items = new Map<string, FeedItem>();

  protected init(): void {
    const feed = el("div", "elaan-feed");
    const head = el("div", "elaan-feed-head");
    const title = el("span", "elaan-feed-title");
    title.textContent = "Notifications";
    this.markAllBtn = el("button", "elaan-link");
    this.markAllBtn.type = "button";
    this.markAllBtn.textContent = "Mark all read";
    this.markAllBtn.dataset.action = "mark-all";
    head.append(title, this.markAllBtn);

    this.status = el("div", "elaan-empty");
    this.list = el("ul", "elaan-list");
    feed.append(head, this.status, this.list);
    this.container.appendChild(feed);

    this.container.addEventListener("click", (e) => {
      const c = getElaanController();
      if (!c) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-action]",
      );
      if (!target) return;
      const action = target.dataset.action;
      if (action === "mark-all") {
        void c.inbox.markAllRead();
        return;
      }
      const id = target.dataset.id;
      if (!id) return;
      if (action === "delete") {
        e.stopPropagation();
        void c.inbox.remove(id);
        return;
      }
      if (action === "open") {
        const n = c.inbox.getState().notifications.find((x) => x.id === id);
        // The row can be gone if a poll landed between paint and click; the
        // documented `detail` is always an ElaanNotification, so emit nothing.
        if (!n) return;
        // Dispatch BEFORE mutating the store: markRead notifies subscribers
        // synchronously, and a listener is free to move or remove this element —
        // a detached node can't bubble a composed event up to document.
        this.dispatchEvent(
          new CustomEvent<ElaanNotification>("notificationclick", {
            detail: n,
            bubbles: true,
            composed: true,
          }),
        );
        if (!n.is_read) void c.inbox.markRead(id);
      }
    });
  }

  protected subscribe(c: ElaanController): () => void {
    return c.inbox.subscribe(() => this.render());
  }

  protected render(): void {
    const c = getElaanController();
    const state = c?.inbox.getState();
    const notifications = state?.notifications ?? [];
    const loading = state?.loading ?? true;
    const unread = c ? c.inbox.getUnreadCount() : 0;

    this.markAllBtn.hidden = unread === 0;

    const empty = notifications.length === 0;
    this.status.hidden = !empty;
    this.list.hidden = empty;
    if (empty) {
      setText(
        this.status,
        loading
          ? "Loading…"
          : this.getAttribute("empty-text") || DEFAULT_EMPTY_TEXT,
      );
    }
    this.reconcile(notifications);
  }

  /**
   * Patch the list in place, keyed by notification id. Rebuilding it with
   * innerHTML reset the scroll position of `.elaan-list` (and blew away focus)
   * on every poll tick and every realtime message.
   */
  private reconcile(notifications: ElaanNotification[]): void {
    let prev: HTMLLIElement | null = null;
    const seen = new Set<string>();

    for (const n of notifications) {
      seen.add(n.id);
      let item = this.items.get(n.id);
      if (!item) {
        item = this.createItem(n.id);
        this.items.set(n.id, item);
      }

      item.li.classList.toggle("elaan-unread", !n.is_read);
      setText(item.title, n.title);
      const body = n.body ?? "";
      setText(item.body, body);
      item.body.hidden = body === "";
      setText(item.time, timeAgo(n.created_at));

      // Only touch the DOM when the row isn't already in the right place.
      const shouldPrecede: Element | null = prev
        ? prev.nextElementSibling
        : this.list.firstElementChild;
      if (shouldPrecede !== item.li) {
        this.list.insertBefore(item.li, shouldPrecede);
      }
      prev = item.li;
    }

    for (const [id, item] of this.items) {
      if (!seen.has(id)) {
        item.li.remove();
        this.items.delete(id);
      }
    }
  }

  private createItem(id: string): FeedItem {
    const li = el("li", "elaan-item");
    li.dataset.action = "open";
    li.dataset.id = id;

    const status = el("span", "elaan-status");
    status.setAttribute("aria-hidden", "true");

    const main = el("div", "elaan-item-main");
    const title = el("div", "elaan-item-title");
    const body = el("div", "elaan-item-body");
    const time = el("div", "elaan-item-time");
    main.append(title, body, time);

    const del = el("button", "elaan-item-del");
    del.type = "button";
    del.textContent = "×";
    del.dataset.action = "delete";
    del.dataset.id = id;
    del.setAttribute("aria-label", "Delete notification");

    li.append(status, main, del);
    return { li, title, body, time };
  }
}

/** `<elaan-bell>` — a bell + unread badge that opens a popover of the feed. */
export class ElaanBellElement extends ElaanElement {
  static observedAttributes = ["empty-text"];
  private open = false;

  private wrap!: HTMLDivElement;
  private button!: HTMLButtonElement;
  private badge!: HTMLSpanElement;
  private popoverEl: HTMLDivElement | null = null;
  private feed: HTMLElement | null = null;

  private onDocDown = (e: MouseEvent): void => {
    if (this.open && !e.composedPath().includes(this)) {
      this.open = false;
      this.render();
    }
  };
  private onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this.open) {
      this.open = false;
      this.render();
      this.button.focus();
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("mousedown", this.onDocDown);
    document.addEventListener("keydown", this.onKey);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.onDocDown);
    document.removeEventListener("keydown", this.onKey);
  }

  protected init(): void {
    this.wrap = el("div", "elaan-bell-wrap");
    this.button = el("button", "elaan-bell");
    this.button.type = "button";
    this.button.dataset.action = "toggle";
    this.button.innerHTML = BELL_SVG;

    this.badge = el("span", "elaan-badge");
    this.badge.setAttribute("aria-hidden", "true");
    this.button.appendChild(this.badge);

    this.wrap.appendChild(this.button);
    this.container.appendChild(this.wrap);

    this.container.addEventListener("click", (e) => {
      const toggle = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-action='toggle']",
      );
      if (!toggle) return;
      this.open = !this.open;
      this.render();
    });
  }

  protected subscribe(c: ElaanController): () => void {
    return c.inbox.subscribe(() => this.render());
  }

  /**
   * Built once, then only shown/hidden. Re-creating the popover on each render
   * tore down and re-mounted the nested `<elaan-feed>` — losing its scroll
   * position and, worse, detaching it mid-click so its `notificationclick` event
   * never reached listeners on the bell or on document.
   */
  private ensurePopover(): void {
    if (this.popoverEl) return;
    const pop = el("div", "elaan-popover");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Notifications");
    this.feed = document.createElement("elaan-feed");
    this.syncEmptyText();
    pop.appendChild(this.feed);
    this.wrap.appendChild(pop);
    this.popoverEl = pop;
  }

  private syncEmptyText(): void {
    if (!this.feed) return;
    const emptyText = this.getAttribute("empty-text");
    if (emptyText === null) this.feed.removeAttribute("empty-text");
    else this.feed.setAttribute("empty-text", emptyText);
  }

  protected render(): void {
    const c = getElaanController();
    const unread = c ? c.inbox.getUnreadCount() : 0;

    setText(this.badge, unread > 99 ? "99+" : String(unread));
    this.badge.hidden = unread === 0;
    this.button.setAttribute("aria-expanded", String(this.open));
    this.button.setAttribute(
      "aria-label",
      unread > 0 ? `Notifications (${unread} unread)` : "Notifications",
    );

    if (this.open) this.ensurePopover();
    if (this.popoverEl) this.popoverEl.hidden = !this.open;
    this.syncEmptyText();
  }
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  inbox: "In-app",
  push: "Push",
};

interface PrefToggle {
  wrap: HTMLLabelElement;
  input: HTMLInputElement;
}

interface PrefRow {
  row: HTMLDivElement;
  label: HTMLDivElement;
  channels: HTMLDivElement;
  inputs: Map<string, PrefToggle>;
}

/** `<elaan-preferences>` — a matrix: one row per type, a toggle per channel. */
export class ElaanPreferencesElement extends ElaanElement {
  private status!: HTMLDivElement;
  private matrix!: HTMLDivElement;
  private rows = new Map<string, PrefRow>();

  protected init(): void {
    this.status = el("div", "elaan-empty");
    this.matrix = el("div", "elaan-prefs");
    this.container.append(this.status, this.matrix);

    this.container.addEventListener("change", (e) => {
      const c = getElaanController();
      if (!c) return;
      const input = e.target as HTMLInputElement;
      const type = input.dataset.type;
      const channel = input.dataset.channel as
        | "email"
        | "inbox"
        | "push"
        | undefined;
      if (!type || !channel) return;
      void c.preferences.setPreference(type, channel, input.checked);
    });
  }

  protected subscribe(c: ElaanController): () => void {
    return c.preferences.subscribe(() => this.render());
  }

  protected render(): void {
    const c = getElaanController();
    const state = c?.preferences.getState();
    const prefs = state?.preferences ?? [];
    const loading = state?.loading ?? true;

    const empty = prefs.length === 0;
    this.status.hidden = !empty;
    this.matrix.hidden = empty;
    if (empty) {
      setText(this.status, loading ? "Loading…" : "No notification types yet.");
    }
    this.reconcile(prefs);
  }

  /**
   * Patch checkboxes in place. `setPreference` triggers an optimistic emit plus
   * two more from the follow-up refresh; rebuilding the inputs on each of those
   * yanked focus off the control the user had just toggled with the keyboard.
   */
  private reconcile(prefs: TypePreference[]): void {
    let prevRow: HTMLDivElement | null = null;
    const seenRows = new Set<string>();

    for (const tp of prefs) {
      const key = tp.notification_type_key;
      seenRows.add(key);
      let row = this.rows.get(key);
      if (!row) {
        row = createPrefRow();
        this.rows.set(key, row);
      }
      setText(row.label, key);

      let prevToggle: HTMLLabelElement | null = null;
      const seenChannels = new Set<string>();
      for (const ch of tp.channels) {
        seenChannels.add(ch.channel);
        let toggle = row.inputs.get(ch.channel);
        if (!toggle) {
          toggle = createPrefToggle(key, ch.channel);
          row.inputs.set(ch.channel, toggle);
        }
        // Only write when it differs, so we never fight the user mid-interaction.
        if (toggle.input.checked !== ch.enabled) {
          toggle.input.checked = ch.enabled;
        }

        const before: Element | null = prevToggle
          ? prevToggle.nextElementSibling
          : row.channels.firstElementChild;
        if (before !== toggle.wrap) row.channels.insertBefore(toggle.wrap, before);
        prevToggle = toggle.wrap;
      }
      for (const [channel, toggle] of row.inputs) {
        if (!seenChannels.has(channel)) {
          toggle.wrap.remove();
          row.inputs.delete(channel);
        }
      }

      const before: Element | null = prevRow
        ? prevRow.nextElementSibling
        : this.matrix.firstElementChild;
      if (before !== row.row) this.matrix.insertBefore(row.row, before);
      prevRow = row.row;
    }

    for (const [key, row] of this.rows) {
      if (!seenRows.has(key)) {
        row.row.remove();
        this.rows.delete(key);
      }
    }
  }
}

function createPrefRow(): PrefRow {
  const row = el("div", "elaan-pref-row");
  const label = el("div", "elaan-pref-type");
  const channels = el("div", "elaan-pref-channels");
  row.append(label, channels);
  return { row, label, channels, inputs: new Map() };
}

function createPrefToggle(type: string, channel: string): PrefToggle {
  const wrap = el("label", "elaan-toggle");
  const input = el("input");
  input.type = "checkbox";
  // dataset + textContent, never string-interpolated markup: a channel key the
  // API adds later can't break out of an attribute or inject into the tree.
  input.dataset.type = type;
  input.dataset.channel = channel;
  const text = el("span");
  text.textContent = CHANNEL_LABELS[channel] ?? channel;
  wrap.append(input, text);
  return { wrap, input };
}

/** Register the custom elements. Call once, before using the tags. Idempotent. */
export function defineElaanElements(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("elaan-feed"))
    customElements.define("elaan-feed", ElaanFeedElement);
  if (!customElements.get("elaan-bell"))
    customElements.define("elaan-bell", ElaanBellElement);
  if (!customElements.get("elaan-preferences"))
    customElements.define("elaan-preferences", ElaanPreferencesElement);
}
