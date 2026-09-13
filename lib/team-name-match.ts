/**
 * Fuzzy team-name matching — the same team's name often differs slightly
 * between sources (Flashscore, API-Football): diacritics, "Utd" vs
 * "United", trailing "FC"/"CF"/etc. Originally lived in
 * scripts/crawl-fixtures.ts (deduping freshly-scraped Flashscore fixtures
 * against existing DB rows); extracted here so lib/api-football-context.ts
 * can reuse the exact same normalization for matching a Flashscore-sourced
 * fixture against API-Football's team names, rather than a second,
 * slightly-different matcher. No "server-only" import — must be loadable
 * via plain tsx in the GitHub-Actions-run scripts, not just Next.js.
 */

export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[.''`´-]/g, " ")
    .replace(/\butd\b/g, "united")
    .replace(/\b(fc|cf|sc|ac|afc|cfk|sfk|cd|ca|club|de|do|da|w)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function namesMatch(a: string, b: string): boolean {
  const ca = normalizeTeamName(a);
  const cb = normalizeTeamName(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const wordsA = new Set(ca.split(" ").filter((w) => w.length > 1));
  const wordsB = new Set(cb.split(" ").filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const [shorter, longer] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  let overlap = 0;
  for (const w of shorter) if (longer.has(w)) overlap++;
  return overlap === shorter.size && overlap > 0;
}
