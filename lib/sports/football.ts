import "server-only";
import { apiSportsKey } from "./api-sports-key";
import { competitionsForSport } from "./competitions";
import type { SportFixture, FixtureState } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

interface RawFixture {
  fixture: {
    id: number;
    date: string;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; logo: string };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

async function get(path: string, params: Record<string, string | number>): Promise<RawFixture[]> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const res = await fetch(url, {
    headers: { "x-apisports-key": apiSportsKey() },
    next: { revalidate: params.live ? 30 : 300 },
  });
  if (!res.ok) throw new Error(`API-Football ${path} failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  return (json.response ?? []) as RawFixture[];
}

/** Live in-play statuses per API-Football's fixture status short codes. */
const LIVE_SHORT_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const FINISHED_SHORT_CODES = new Set(["FT", "AET", "PEN"]);
const CANCELLED_SHORT_CODES = new Set(["CANC", "ABD", "AWD", "WO"]);

function toFixtureState(short: string): FixtureState {
  if (LIVE_SHORT_CODES.has(short)) return "live";
  if (FINISHED_SHORT_CODES.has(short)) return "finished";
  if (short === "PST") return "postponed";
  if (CANCELLED_SHORT_CODES.has(short)) return "cancelled";
  return "scheduled";
}

function toSportFixture(raw: RawFixture): SportFixture {
  const { short, long, elapsed } = raw.fixture.status;
  return {
    id: `football:${raw.fixture.id}`,
    sport: "football",
    competition: { id: raw.league.id, name: raw.league.name, country: raw.league.country, logo: raw.league.logo },
    kickoff: raw.fixture.date,
    status: {
      state: toFixtureState(short),
      label: long,
      clock: elapsed != null ? `${elapsed}'` : null,
    },
    home: { name: raw.teams.home.name, logo: raw.teams.home.logo, score: raw.goals.home },
    away: { name: raw.teams.away.name, logo: raw.teams.away.logo, score: raw.goals.away },
  };
}

/** All currently live football fixtures across our curated competitions. */
export async function fetchLiveFootballFixtures(): Promise<SportFixture[]> {
  const leagueIds = competitionsForSport("football").map((c) => c.apiLeagueId);
  const raw = await get("/fixtures", { live: leagueIds.join("-") });
  return raw.map(toSportFixture);
}

/** Football fixtures for a given date (YYYY-MM-DD) across our curated competitions. */
export async function fetchFootballFixturesByDate(date: string): Promise<SportFixture[]> {
  const leagues = competitionsForSport("football");
  const results = await Promise.all(
    leagues.map((league) => get("/fixtures", { date, league: league.apiLeagueId, season: new Date(date).getFullYear() })),
  );
  return results.flat().map(toSportFixture);
}
