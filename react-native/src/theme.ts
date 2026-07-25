// Default palette. (RN has no CSS variables; a future version can accept a theme
// prop / context — for now these defaults match the web SDK's light theme.)
export const colors = {
  accent: "#45b0ee",
  // Ink on top of `accent`. Dark, not white: white on this light blue is only
  // ~2.4:1, well under the 4.5:1 contrast floor for the badge's small bold text.
  accentInk: "#04121e",
  bg: "#ffffff",
  bgHover: "#f4f6f9",
  text: "#1a1d23",
  muted: "#6b7280",
  border: "#e5e7eb",
  danger: "#ef4444",
};

export function timeAgo(iso: string): string {
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
