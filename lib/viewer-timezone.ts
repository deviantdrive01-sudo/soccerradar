/**
 * A downloadable image is rendered server-side, with no idea which viewer
 * asked for it — appending the browser's own detected IANA zone lets a
 * route that cares (e.g. a match/league image's kickoff time) show it in
 * the viewer's own local time instead of a fixed zone. Harmless for routes
 * that don't read a "tz" param at all.
 */
export function withViewerTimeZone(imageUrl: string): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const separator = imageUrl.includes("?") ? "&" : "?";
    return `${imageUrl}${separator}tz=${encodeURIComponent(tz)}`;
  } catch {
    return imageUrl;
  }
}
