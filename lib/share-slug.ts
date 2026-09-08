/**
 * Lets a share permalink read as `/mixes/42-johndoe` instead of just
 * `/mixes/42` — the numeric id stays the authoritative lookup key (Next's
 * `parseInt` naturally stops at the first non-digit character, so the
 * username suffix is purely cosmetic and old bare-id links keep working
 * unchanged), while the owner's name becomes visible in the URL itself.
 */
export function buildShareSlug(id: number, username: string | null): string {
  if (!username) return String(id);
  const slug = username
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${id}-${slug}` : String(id);
}

/** Extracts the leading numeric id from a param that may carry a `-username` suffix. */
export function parseIdFromParam(param: string): number | null {
  const match = param.match(/^\d+/);
  if (!match) return null;
  const id = Number(match[0]);
  return Number.isInteger(id) ? id : null;
}
