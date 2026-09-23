import "server-only";
import { apiSportsKey } from "./api-sports-key";
import { competitionsForSport } from "./competitions";
import type { SportFixture, FixtureState } from "./types";

const BASE_URL = "https://v1.basketball.api-sports.io";

interface RawGame {
  id: number;
  date: string;
  status: { long: string; short: string; timer: string | null };
  league: { id: number; name: string; logo: string };
  country: { name: string };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  scores: {
    home: { total: number | null };
    away: { total: number | null };
  };
}

async function get(path: string, params: Record<string, string | number>): Promise<RawGame[]> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const res = await fetch(url, {
    headers: { "x-apisports-key": apiSportsKey() },
    next: { revalidate: params.live ? 30 : 300 },
  });
  if (!res.ok) throw new Error(`API-Basketball ${path} failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  return (json.response ?? []) as RawGame[];
}

/** Live in-play statuses per API-Basketball's game status short codes. */
const LIVE_SHORT_CODES = new Set(["Q1", "Q2", "Q3", "Q4", "OT", "BT", "HT", "SUSP"]);
const FINISHED_SHORT_CODES = new Set(["FT", "AOT"]);
const CANCELLED_SHORT_CODES = new Set(["CANC", "ABD", "AWD"]);

function toFixtureState(short: string): FixtureState {
  if (LIVE_SHORT_CODES.has(short)) return "live";
  if (FINISHED_SHORT_CODES.has(short)) return "finished";
  if (short === "POST") return "postponed";
  if (CANCELLED_SHORT_CODES.has(short)) return "cancelled";
  return "scheduled";
}

function toSportFixture(raw: RawGame): SportFixture {
  const { short, long, timer } = raw.status;
  return {
    id: `basketball:${raw.id}`,
    sport: "basketball",
    competition: { id: raw.league.id, name: raw.league.name, country: raw.country.name, logo: raw.league.logo },
    kickoff: raw.date,
    status: {
      state: toFixtureState(short),
      label: long,
      clock: timer,
    },
    home: { name: raw.teams.home.name, logo: raw.teams.home.logo, score: raw.scores.home.total },
    away: { name: raw.teams.away.name, logo: raw.teams.away.logo, score: raw.scores.away.total },
  };
}

/** All currently live basketball games across our curated competitions. */
export async function fetchLiveBasketballGames(): Promise<SportFixture[]> {
  const leagueIds = competitionsForSport("basketball").map((c) => c.apiLeagueId);
  const raw = await get("/games", { live: leagueIds.join("-") });
  return raw.map(toSportFixture);
}

/** Basketball games for a given date (YYYY-MM-DD) across our curated competitions. */
export async function fetchBasketballGamesByDate(date: string): Promise<SportFixture[]> {
  const leagues = competitionsForSport("basketball");
  const results = await Promise.all(
    leagues.map((league) => get("/games", { date, league: league.apiLeagueId, season: new Date(date).getFullYear() })),
  );
  return results.flat().map(toSportFixture);
}
