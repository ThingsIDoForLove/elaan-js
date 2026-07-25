import {
  getElaanController,
  onControllerChange,
  type ElaanController,
} from "./controller";
import { applyStyles } from "./styles";

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[ch]!,
  );
}

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

const BELL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;

/** Shared base: owns the shadow root, styles, and controller/store binding. */
abstract class ElaanElement extends HTMLElement {
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

  /** One-time setup (delegated event listeners). */
  protected init(): void {}
  /** Subscribe to the store this element renders; return an unsubscribe. */
  protected abstract subscribe(c: ElaanController): () => void;
  protected abstract render(): void;
}

/** `<elaan-feed>` — the inbox list: mark-read on click, mark-all-read, delete. */
export class ElaanFeedElement extends ElaanElement {
  static observedAttributes = ["empty-text"];

  protected init(): void {
    this.container.addEventListener("click", (e) => {
      const c = getElaanController();
      if (!c) return;
      const target = e.target as HTMLElement;
      const el = target.closest<HTMLElement>("[data-action]");
      if (!el) return;
      const action = el.dataset.action;
      if (action === "mark-all") {
        void c.inbox.markAllRead();
        return;
      }
      const id = el.dataset.id;
      if (!id) return;
      if (action === "delete") {
        e.stopPropagation();
        void c.inbox.remove(id);
      } else if (action === "open") {
        const n = c.inbox.getState().notifications.find((x) => x.id === id);
        if (n && !n.is_read) void c.inbox.markRead(id);
        this.dispatchEvent(
          new CustomEvent("notificationclick", {
            detail: n,
            bubbles: true,
            composed: true,
          }),
        );
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
    const emptyText = this.getAttribute("empty-text") || "You're all caught up.";

    const head = `<div class="elaan-feed-head"><span class="elaan-feed-title">Notifications</span>${
      unread > 0
        ? `<button class="elaan-link" data-action="mark-all">Mark all read</button>`
        : ""
    }</div>`;

    let body: string;
    if (loading && notifications.length === 0) {
      body = `<div class="elaan-empty">Loading…</div>`;
    } else if (notifications.length === 0) {
      body = `<div class="elaan-empty">${esc(emptyText)}</div>`;
    } else {
      body =
        `<ul class="elaan-list">` +
        notifications
          .map(
            (n) =>
              `<li class="elaan-item${n.is_read ? "" : " elaan-unread"}" data-action="open" data-id="${esc(n.id)}">` +
              `<span class="elaan-status"></span>` +
              `<div class="elaan-item-main">` +
              `<div class="elaan-item-title">${esc(n.title)}</div>` +
              (n.body ? `<div class="elaan-item-body">${esc(n.body)}</div>` : "") +
              `<div class="elaan-item-time">${esc(timeAgo(n.created_at))}</div>` +
              `</div>` +
              `<button class="elaan-item-del" data-action="delete" data-id="${esc(n.id)}" aria-label="Delete notification">×</button>` +
              `</li>`,
          )
          .join("") +
        `</ul>`;
    }

    this.container.innerHTML = `<div class="elaan-feed">${head}${body}</div>`;
  }
}

/** `<elaan-bell>` — a bell + unread badge that opens a popover of the feed. */
export class ElaanBellElement extends ElaanElement {
  static observedAttributes = ["empty-text"];
  private open = false;

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
    this.container.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-action='toggle']",
      );
      if (!el) return;
      this.open = !this.open;
      this.render();
    });
  }

  protected subscribe(c: ElaanController): () => void {
    return c.inbox.subscribe(() => this.render());
  }

  protected render(): void {
    const c = getElaanController();
    const unread = c ? c.inbox.getUnreadCount() : 0;
    const emptyAttr = this.getAttribute("empty-text");
    const feed = `<elaan-feed${emptyAttr ? ` empty-text="${esc(emptyAttr)}"` : ""}></elaan-feed>`;

    this.container.innerHTML =
      `<div class="elaan-bell-wrap">` +
      `<button type="button" class="elaan-bell" aria-label="Notifications" aria-expanded="${this.open}" data-action="toggle">` +
      BELL_SVG +
      (unread > 0
        ? `<span class="elaan-badge">${unread > 99 ? "99+" : unread}</span>`
        : "") +
      `</button>` +
      (this.open
        ? `<div class="elaan-popover" role="dialog" aria-label="Notifications">${feed}</div>`
        : "") +
      `</div>`;
  }
}

/** `<elaan-preferences>` — a matrix: one row per type, a toggle per channel. */
export class ElaanPreferencesElement extends ElaanElement {
  protected init(): void {
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

    if (loading && prefs.length === 0) {
      this.container.innerHTML = `<div class="elaan-empty">Loading…</div>`;
      return;
    }
    if (prefs.length === 0) {
      this.container.innerHTML = `<div class="elaan-empty">No notification types yet.</div>`;
      return;
    }

    const labels: Record<string, string> = {
      email: "Email",
      inbox: "In-app",
      push: "Push",
    };
    this.container.innerHTML =
      `<div class="elaan-prefs">` +
      prefs
        .map(
          (tp) =>
            `<div class="elaan-pref-row">` +
            `<div class="elaan-pref-type">${esc(tp.notification_type_key)}</div>` +
            `<div class="elaan-pref-channels">` +
            tp.channels
              .map(
                (ch) =>
                  `<label class="elaan-toggle"><input type="checkbox" data-type="${esc(tp.notification_type_key)}" data-channel="${ch.channel}"${ch.enabled ? " checked" : ""}/><span>${labels[ch.channel] ?? ch.channel}</span></label>`,
              )
              .join("") +
            `</div></div>`,
        )
        .join("") +
      `</div>`;
  }
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
