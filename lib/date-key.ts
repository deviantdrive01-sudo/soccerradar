/**
 * Calendar-day key in UTC, not the viewer's local time zone — pages using
 * this are statically prerendered, so a per-viewer time zone would make the
 * server's grouping disagree with the client's on hydration (React error #418).
 */
export function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
