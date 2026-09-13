/**
 * API-Football as an extra data source for curated leagues (leagues.use_api_football)
 * — fixture discovery fallback (scripts/crawl-fixtures.ts) and Claude
 * prediction context (scripts/generate-predictions.ts, lib/prediction-engine.ts).
 *
 * Deliberately NOT built on lib/api-football.ts (which is `import "server-only"`
 * and dead code today, only reached by the unscheduled
 * app/api/cron/predictions/route.ts) — this module has no "server-only"
 * import so it can be loaded via plain tsx in scripts/generate-predictions.ts's
 * and scripts/crawl-fixtures.ts's GitHub Actions Node environment, same
 * reasoning already documented at the top of generate-predictions.ts for why
 * its SYSTEM_PROMPT is duplicated rather than imported from lib/prediction-engine.ts.
 *
 * Every function here degrades gracefully: a fixture that can't be
 * confidently resolved, or a request that fails, returns null rather than
 * throwing — API-Football is always optional extra context here, never a
 * hard dependency for a fixture to get a prediction.
 */
import { namesMatch } from "./team-name-match";
import type { ApiFootballPredictionContext, ApiFootballH2hMeeting } from "./supabase/types";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

function apiFootballHeaders(): HeadersInit {
  return { "x-apisports-key": process.env.API_FOOTBALL_KEY ?? "" };
}

async function apiFootballGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_FOOTBALL_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { headers: apiFootballHeaders() });
  if (!res.ok) {
    throw new Error(`API-Football ${path} failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.response as T;
}

/** Jul-Dec -> that year's season; Jan-Jun -> the previous year's — the standard European-season split. A documented simplification: it degrades to "no confident match" rather than a wrong one for calendar-year leagues, since those only ever have fixtures in the season the date's own year already implies. */
function inferSeason(matchDate: string): number {
  const d = new Date(matchDate);
  const month = d.getUTCMonth() + 1; // 1-12
  return month >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface ApiFootballFixtureListItem {
  fixture: { id: number; date: string };
  teams: { home: { name: string }; away: { name: string } };
}

export interface ApiFootballFixtureMatch {
  fixtureId: number;
  confidence: "exact" | "fuzzy";
}

/**
 * Resolves a Flashscore-sourced fixture (league + date + team names) to its
 * API-Football fixture id. Returns null for anything short of a confident
 * single match — zero candidates, ambiguous multi-candidate ties, or a
 * home/away side-swap collision — logging the reason via console.warn so
 * misses are visible in the GitHub Actions run log. Only throws on a
 * genuine request failure (network/non-2xx), which callers must catch
 * alongside their other per-fixture failure modes.
 */
export async function resolveApiFootballFixture(
  apiLeagueId: number,
  matchDate: string,
  homeTeam: string,
  awayTeam: string,
): Promise<ApiFootballFixtureMatch | null> {
  const date = ymd(new Date(matchDate));
  const season = inferSeason(matchDate);
  const candidates = await apiFootballGet<ApiFootballFixtureListItem[]>("/fixtures", {
    league: apiLeagueId,
    season,
    date,
  });

  const exact = candidates.filter(
    (c) => c.teams.home.name.trim().toLowerCase() === homeTeam.trim().toLowerCase() && c.teams.away.name.trim().toLowerCase() === awayTeam.trim().toLowerCase(),
  );
  if (exact.length === 1) {
    return { fixtureId: exact[0].fixture.id, confidence: "exact" };
  }
  if (exact.length > 1) {
    console.warn(`API-Football: ${exact.length} exact-name candidates for ${homeTeam} vs ${awayTeam} on ${date} (league ${apiLeagueId}) — ambiguous, skipping.`);
    return null;
  }

  const fuzzy = candidates.filter(
    (c) => namesMatch(c.teams.home.name, homeTeam) && namesMatch(c.teams.away.name, awayTeam),
  );
  if (fuzzy.length === 1) {
    return { fixtureId: fuzzy[0].fixture.id, confidence: "fuzzy" };
  }

  console.warn(
    `API-Football: no confident match for ${homeTeam} vs ${awayTeam} on ${date} (league ${apiLeagueId}) — ${candidates.length} candidate(s), ${fuzzy.length} fuzzy match(es).`,
  );
  return null;
}

export interface ApiFootballDiscoveredFixture {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO
}

/** All fixtures for a league in [from, to] (both ISO datetimes) — used by scripts/crawl-fixtures.ts's fallback discovery for curated leagues Flashscore's scrape missed. */
export async function fetchApiFootballFixturesInRange(
  apiLeagueId: number,
  from: Date,
  to: Date,
): Promise<ApiFootballDiscoveredFixture[]> {
  const season = inferSeason(from.toISOString());
  const fixtures = await apiFootballGet<ApiFootballFixtureListItem[]>("/fixtures", {
    league: apiLeagueId,
    season,
    from: ymd(from),
    to: ymd(to),
  });
  return fixtures.map((f) => ({
    fixtureId: f.fixture.id,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    kickoff: f.fixture.date,
  }));
}

export interface ApiFootballLeagueSummary {
  id: number;
  name: string;
  type: string; // "League" | "Cup"
  country: string;
  logo: string;
  countryFlag: string | null;
  currentSeason: number | null;
  hasStatistics: boolean;
}

interface RawLeagueListItem {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: { year: number; current: boolean; coverage?: { fixtures?: { statistics_fixtures?: boolean } } }[];
}

/**
 * The full catalog of leagues/cups API-Football currently tracks a season
 * for (~1,237 as of this writing) — used by /admin/leagues/browse so an
 * admin can discover and curate in leagues beyond the ones already in our
 * `leagues` table. Fetched once per page load; not paginated server-side —
 * the response is small enough (a few hundred KB of JSON) to filter/search
 * client-side instead of building real pagination against API-Football.
 */
export async function fetchAllApiFootballLeagues(): Promise<ApiFootballLeagueSummary[]> {
  const raw = await apiFootballGet<RawLeagueListItem[]>("/leagues", { current: "true" });
  return raw.map((r) => {
    const current = r.seasons.find((s) => s.current) ?? null;
    return {
      id: r.league.id,
      name: r.league.name,
      type: r.league.type,
      country: r.country.name,
      logo: r.league.logo,
      countryFlag: r.country.flag,
      currentSeason: current?.year ?? null,
      hasStatistics: current?.coverage?.fixtures?.statistics_fixtures ?? false,
    };
  });
}

// ---------- /predictions trimming ----------

interface RawTeamSummary {
  last_5: { form: string; att: string; def: string };
  league: {
    form: string;
    fixtures: { played: { total: number } };
    goals: { for: { average: { total: string } }; against: { average: { total: string } } };
    clean_sheet: { total: number };
    failed_to_score: { total: number };
  };
}

interface RawPredictionsResponse {
  predictions: {
    winner: { comment: string | null } | null;
    advice: string | null;
    percent: { home: string; draw: string; away: string };
  };
  comparison: {
    form: { home: string; away: string };
    att: { home: string; away: string };
    def: { home: string; away: string };
    poisson_distribution: { home: string; away: string };
    h2h: { home: string; away: string };
    goals: { home: string; away: string };
    total: { home: string; away: string };
  } | null;
  teams: { home: RawTeamSummary; away: RawTeamSummary };
  h2h: {
    fixture: { id: number; date: string };
    teams: { home: { name: string }; away: { name: string } };
    goals: { home: number | null; away: number | null };
  }[];
}

interface RawFixtureStatisticsItem {
  team: { name: string };
  statistics: { type: string; value: string | number | null }[];
}

/**
 * "Total Shots" for both sides of a batch of already-played h2h meetings,
 * keyed by fixture id — used to enrich the h2h array for the Total Shots
 * market. One /fixtures/statistics call per meeting; a meeting with no
 * stats coverage that season (or a request failure) just contributes null
 * rather than failing the batch, same "degrade, don't block" contract as
 * every other API-Football call in this module. Matches each side's stats
 * by team name rather than array position — the API's own team ordering
 * within /fixtures/statistics isn't documented as home-first.
 */
async function fetchH2hShots(
  meetings: { fixtureId: number; homeTeam: string; awayTeam: string }[],
): Promise<Map<number, { home: number; away: number } | null>> {
  const results = new Map<number, { home: number; away: number } | null>();
  await Promise.all(
    meetings.map(async ({ fixtureId, homeTeam, awayTeam }) => {
      try {
        const stats = await apiFootballGet<RawFixtureStatisticsItem[]>("/fixtures/statistics", { fixture: fixtureId });
        const shotsFor = (teamName: string) => {
          const team = stats.find((s) => s.team.name === teamName);
          const found = team?.statistics.find((s) => s.type === "Total Shots");
          return typeof found?.value === "number" ? found.value : null;
        };
        const home = shotsFor(homeTeam);
        const away = shotsFor(awayTeam);
        results.set(fixtureId, home !== null && away !== null ? { home, away } : null);
      } catch (err) {
        console.warn(`API-Football: /fixtures/statistics fetch failed for fixture ${fixtureId}:`, err instanceof Error ? err.message : err);
        results.set(fixtureId, null);
      }
    }),
  );
  return results;
}

function pct(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function summarizeTeam(raw: RawTeamSummary): ApiFootballPredictionContext["teams"]["home"] {
  const played = raw.league.fixtures.played.total;
  return {
    last5Form: raw.last_5.form ?? null,
    seasonForm: raw.league.form ?? null,
    goalsForAvg: raw.league.goals.for.average.total ? Number(raw.league.goals.for.average.total) : null,
    goalsAgainstAvg: raw.league.goals.against.average.total ? Number(raw.league.goals.against.average.total) : null,
    cleanSheetPct: pct(raw.league.clean_sheet.total, played),
    failedToScorePct: pct(raw.league.failed_to_score.total, played),
  };
}

/** Fills in .totalShots for each h2h meeting via fetchH2hShots, in one parallel batch. */
async function attachH2hShots(meetings: ApiFootballH2hMeeting[]): Promise<ApiFootballH2hMeeting[]> {
  if (meetings.length === 0) return meetings;
  const shotsById = await fetchH2hShots(meetings);
  return meetings.map((m) => ({ ...m, totalShots: shotsById.get(m.fixtureId) ?? null }));
}

/**
 * Fetches and trims API-Football's /predictions response for an
 * already-resolved fixture id. Returns null on request failure (caught
 * internally, logged, never thrown) — by this point a resolution miss and
 * a fetch failure both just mean "no context for this fixture."
 */
export async function fetchApiFootballPredictionContext(fixtureId: number): Promise<ApiFootballPredictionContext | null> {
  try {
    const [raw] = await apiFootballGet<RawPredictionsResponse[]>("/predictions", { fixture: fixtureId });
    if (!raw) return null;

    return {
      winnerComment: raw.predictions.winner?.comment ?? null,
      advice: raw.predictions.advice,
      percent: raw.predictions.percent,
      comparison: raw.comparison
        ? {
            form: raw.comparison.form,
            att: raw.comparison.att,
            def: raw.comparison.def,
            poissonDistribution: raw.comparison.poisson_distribution,
            h2h: raw.comparison.h2h,
            goals: raw.comparison.goals,
            total: raw.comparison.total,
          }
        : null,
      teams: {
        home: summarizeTeam(raw.teams.home),
        away: summarizeTeam(raw.teams.away),
      },
      h2h: await attachH2hShots(
        raw.h2h.slice(0, 10).map((m) => ({
          fixtureId: m.fixture.id,
          date: m.fixture.date,
          homeTeam: m.teams.home.name,
          awayTeam: m.teams.away.name,
          homeScore: m.goals.home,
          awayScore: m.goals.away,
        })),
      ),
    };
  } catch (err) {
    console.warn(`API-Football: /predictions fetch failed for fixture ${fixtureId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
