import "server-only";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

// Reserve teams, women's sides, and youth squads all share the senior club's
// name in API-Football's search results — de-prioritize anything with one of
// these suffixes so the senior men's crest wins by default.
const DEPRIORITIZED_SUFFIXES = [" w", " u23", " u21", " u20", " u19", " u18", " reserves"];

interface ApiFootballTeamResult {
  team: { id: number; name: string; national: boolean; logo: string };
}

function isBetterMatch(candidate: ApiFootballTeamResult, teamName: string, current: ApiFootballTeamResult | null): boolean {
  if (!current) return true;
  const name = candidate.team.name.toLowerCase();
  const currentName = current.team.name.toLowerCase();
  const wanted = teamName.toLowerCase();

  const exact = name === wanted;
  const currentExact = currentName === wanted;
  if (exact !== currentExact) return exact;

  const deprioritized = DEPRIORITIZED_SUFFIXES.some((s) => name.endsWith(s)) || candidate.team.national;
  const currentDeprioritized = DEPRIORITIZED_SUFFIXES.some((s) => currentName.endsWith(s)) || current.team.national;
  if (deprioritized !== currentDeprioritized) return !deprioritized;

  return false; // keep the first (API-Football's own relevance order) on a tie
}

async function findTeamLogoUrl(teamName: string): Promise<string | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${API_FOOTBALL_BASE_URL}/teams?search=${encodeURIComponent(teamName)}`, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const results = (json?.response ?? []) as ApiFootballTeamResult[];
    if (results.length === 0) return null;

    let best: ApiFootballTeamResult | null = null;
    for (const r of results) {
      if (isBetterMatch(r, teamName, best)) best = r;
    }
    return best?.team.logo ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a team's crest to an inlined base64 data URI (Satori's remote
 * `<img src>` fetching is unreliable — same reasoning as
 * resolveAvatarDataUri in lib/share-image.tsx) via API-Football's team
 * search. Returns null on any failure so the caller can fall back to a
 * text/initials treatment rather than a broken image.
 */
export async function getTeamCrestDataUri(teamName: string): Promise<string | null> {
  const logoUrl = await findTeamLogoUrl(teamName);
  if (!logoUrl) return null;

  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
