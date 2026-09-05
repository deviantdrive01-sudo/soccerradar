import "server-only";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

function apiFootballHeaders(): HeadersInit {
  return { "x-apisports-key": process.env.API_FOOTBALL_KEY! };
}

async function apiFootballGet<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${API_FOOTBALL_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { headers: apiFootballHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API-Football ${path} failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.response as T;
}

export interface ApiFixture {
  fixture: { id: number; date: string };
  league: { id: number; season: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
}

/** Fixtures for a league within [from, to] (YYYY-MM-DD), current season inferred by API-Football. */
export async function fetchWeeklyFixtures(
  apiLeagueId: number,
  from: string,
  to: string,
): Promise<ApiFixture[]> {
  return apiFootballGet<ApiFixture[]>("/fixtures", {
    league: apiLeagueId,
    from,
    to,
  });
}

export interface FixtureStatsContext {
  headToHead: unknown;
  homeTeamForm: unknown;
  awayTeamForm: unknown;
}

/** Compact stats bundle for a single fixture, used as Claude's analysis context. */
export async function fetchFixtureStats(
  fixture: ApiFixture,
): Promise<FixtureStatsContext> {
  const { home, away } = fixture.teams;

  const [headToHead, homeTeamForm, awayTeamForm] = await Promise.all([
    apiFootballGet<unknown>("/fixtures/headtohead", {
      h2h: `${home.id}-${away.id}`,
      last: 5,
    }),
    apiFootballGet<unknown>("/fixtures", { team: home.id, last: 5 }),
    apiFootballGet<unknown>("/fixtures", { team: away.id, last: 5 }),
  ]);

  return { headToHead, homeTeamForm, awayTeamForm };
}
