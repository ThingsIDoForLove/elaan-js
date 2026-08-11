// Shadow-DOM styles. Themeable from outside via `--elaan-*` custom properties
// (custom properties inherit through the shadow boundary); internal `--_*` tokens
// map each to a default so light/dark work out of the box and user overrides win.
export const CSS = `
:host {
  --_accent: var(--elaan-accent, #45b0ee);
  /* Ink on top of --_accent. Dark by default because the default accent is a
     light blue — white here is only ~2.4:1, well under the 4.5:1 floor. Override
     --elaan-accent-ink alongside a darker --elaan-accent. */
  --_accent-ink: var(--elaan-accent-ink, #04121e);
  --_bg: var(--elaan-bg, #ffffff);
  --_bg-hover: var(--elaan-bg-hover, #f4f6f9);
  --_text: var(--elaan-text, #1a1d23);
  --_muted: var(--elaan-muted, #6b7280);
  --_border: var(--elaan-border, #e5e7eb);
  --_danger: var(--elaan-danger, #ef4444);
  --_radius: var(--elaan-radius, 10px);
  --_shadow: var(--elaan-shadow, 0 12px 32px -12px rgba(0, 0, 0, 0.3));
  --_font: var(--elaan-font, inherit);
  --_z: var(--elaan-z, 1000);
  /* Block by default so <elaan-feed>/<elaan-preferences> fill their container;
     only the bell is an inline control. */
  display: block;
  color: var(--_text);
  /* Longhand, not the font shorthand: the shorthand also resets font-family,
     and font-family inherits through the shadow boundary, so the shorthand
     silently opted out of the host app's type stack. Unset, --_font resolves
     to inherit and the host's stack is adopted; name a stack in --elaan-font
     to pin one. */
  font-family: var(--_font);
  font-size: 14px;
  line-height: 1.5;
}
:host(elaan-bell) { display: inline-block; }
/* --_danger and --_shadow belong here too: a drop shadow tuned for a white
   page is close to invisible against a dark surface, so the popover loses its
   separation from what is behind it. */
@media (prefers-color-scheme: dark) {
  :host {
    --_bg: var(--elaan-bg, #12151d);
    --_bg-hover: var(--elaan-bg-hover, #1a1f2a);
    --_text: var(--elaan-text, #e8eaf0);
    --_muted: var(--elaan-muted, #8b93a3);
    --_border: var(--elaan-border, #262c38);
    --_danger: var(--elaan-danger, #f87171);
    --_shadow: var(--elaan-shadow, 0 12px 32px -12px rgba(0, 0, 0, 0.75));
  }
}
* { box-sizing: border-box; }
/* The elements toggle visibility with the hidden property rather than by
   rebuilding markup; make sure it beats the display rules below. */
[hidden] { display: none !important; }

.elaan-bell-wrap { position: relative; display: inline-block; }
.elaan-bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  color: var(--_text);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}
.elaan-bell:hover { background: var(--_bg-hover); }
.elaan-bell svg { width: 20px; height: 20px; }
.elaan-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-weight: 600;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: var(--_accent-ink);
  background: var(--_accent);
  border-radius: 8px;
}

.elaan-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: var(--_z);
  width: 360px;
  max-width: 92vw;
  background: var(--_bg);
  color: var(--_text);
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  box-shadow: var(--_shadow);
  overflow: hidden;
}

.elaan-feed { color: var(--_text); }
.elaan-feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--_border);
}
.elaan-feed-title { font-weight: 600; }
.elaan-link {
  padding: 0;
  font: inherit;
  font-size: 0.8rem;
  color: var(--_accent);
  background: none;
  border: none;
  cursor: pointer;
}
.elaan-empty { padding: 2rem 1rem; text-align: center; color: var(--_muted); }
.elaan-list { list-style: none; margin: 0; padding: 0; max-height: 26rem; overflow-y: auto; }
.elaan-item {
  position: relative;
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--_border);
  cursor: pointer;
}
.elaan-item:hover { background: var(--_bg-hover); }
.elaan-unread-dot,
.elaan-status { flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: transparent; }
.elaan-item[data-unread] .elaan-unread-dot,
.elaan-item.elaan-unread .elaan-unread-dot,
.elaan-item[data-unread] .elaan-status,
.elaan-item.elaan-unread .elaan-status { background: var(--_accent); }
.elaan-item-main { flex: 1; min-width: 0; outline-offset: -2px; }
.elaan-item-title { font-weight: 600; }
.elaan-item[data-unread] .elaan-item-title,
.elaan-item.elaan-unread .elaan-item-title { font-weight: 700; }
.elaan-item-body { color: var(--_muted); font-size: 0.88rem; margin-top: 2px; }
.elaan-item-time { color: var(--_muted); font-size: 0.75rem; margin-top: 4px; }
.elaan-item-del {
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  color: var(--_muted);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
}
/* Revealed on focus as well as hover: without this a keyboard user tabs
   onto an invisible button and the next Enter deletes a notification with
   no visible cause. */
.elaan-item:hover .elaan-item-del,
.elaan-item:focus-within .elaan-item-del,
.elaan-item-del:focus-visible { opacity: 1; }
.elaan-item-del:hover { color: var(--_danger); background: var(--_bg-hover); }

.elaan-prefs { display: flex; flex-direction: column; gap: 0.5rem; }
.elaan-pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
}
.elaan-pref-type { font-weight: 600; }
.elaan-pref-channels { display: flex; gap: 0.9rem; flex-wrap: wrap; }
.elaan-toggle { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--_muted); cursor: pointer; }
.elaan-toggle input { accent-color: var(--_accent); }
`;

let sheet: CSSStyleSheet | null = null;

/** Attach the shared stylesheet to a shadow root (constructable sheet, or a
 *  <style> fallback for older engines). */
export function applyStyles(root: ShadowRoot): void {
  try {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
    }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
  }
}
