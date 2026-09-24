import "server-only";
import { footballApiKey } from "./api-sports-key";
import { competitionsForSport } from "./competitions";
import type { FixtureDetail, HeadToHeadMeeting, HeadToHeadStats, SportFixture, FixtureState } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

interface RawFixture {
  fixture: {
    id: number;
    date: string;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; logo: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const res = await fetch(url, {
    headers: { "x-apisports-key": footballApiKey() },
    next: { revalidate: params.live ? 30 : 300 },
  });
  if (!res.ok) throw new Error(`API-Football ${path} failed: ${res.status} ${res.statusText}`);

  const json = await res.json();
  return (json.response ?? []) as T[];
}

interface RawTeamStatistics {
  team: { id: number };
  statistics: { type: string; value: number | string | null }[];
}

/** A team's numeric value for one API-Football statistic "type" in a fixture, or null if unavailable. */
function statValue(stats: RawTeamStatistics[], teamId: number, type: string): number | null {
  const value = stats.find((s) => s.team.id === teamId)?.statistics.find((s) => s.type === type)?.value;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value.replace("%", "")) || null;
  return null;
}

/** Sums yellow + red cards for a team; null (not 0) when the provider has no card stats at all for this fixture. */
function cardCount(stats: RawTeamStatistics[], teamId: number): number | null {
  const yellow = statValue(stats, teamId, "Yellow Cards");
  const red = statValue(stats, teamId, "Red Cards");
  if (yellow === null && red === null) return null;
  return (yellow ?? 0) + (red ?? 0);
}

/** Per-team shots/corners/cards for one past fixture — null when the provider has no stats for it (common for older/lower-tier matches). */
async function fetchFixtureStats(fixtureId: number, homeId: number, awayId: number): Promise<HeadToHeadStats | null> {
  const stats = await get<RawTeamStatistics>("/fixtures/statistics", { fixture: fixtureId });
  if (stats.length === 0) return null;

  return {
    shots: { home: statValue(stats, homeId, "Total Shots"), away: statValue(stats, awayId, "Total Shots") },
    corners: { home: statValue(stats, homeId, "Corner Kicks"), away: statValue(stats, awayId, "Corner Kicks") },
    cards: { home: cardCount(stats, homeId), away: cardCount(stats, awayId) },
  };
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
    home: { id: raw.teams.home.id, name: raw.teams.home.name, logo: raw.teams.home.logo, score: raw.goals.home },
    away: { id: raw.teams.away.id, name: raw.teams.away.name, logo: raw.teams.away.logo, score: raw.goals.away },
  };
}

/** All currently live football fixtures across our curated competitions. */
export async function fetchLiveFootballFixtures(): Promise<SportFixture[]> {
  const leagueIds = competitionsForSport("football").map((c) => c.apiLeagueId);
  const raw = await get<RawFixture>("/fixtures", { live: leagueIds.join("-") });
  return raw.map(toSportFixture);
}

/** Football fixtures for a given date (YYYY-MM-DD) across our curated competitions. */
export async function fetchFootballFixturesByDate(date: string): Promise<SportFixture[]> {
  const leagues = competitionsForSport("football");
  const results = await Promise.all(
    leagues.map((league) =>
      get<RawFixture>("/fixtures", { date, league: league.apiLeagueId, season: new Date(date).getFullYear() }),
    ),
  );
  return results.flat().map(toSportFixture);
}

/** A single fixture's current state, plus its two teams' 4 most recent meetings (each with shots/corners/cards, where the provider has them). */
export async function fetchFootballFixtureDetail(fixtureId: number): Promise<FixtureDetail | null> {
  const [fixtureRaw] = await get<RawFixture>("/fixtures", { id: fixtureId });
  if (!fixtureRaw) return null;

  const fixture = toSportFixture(fixtureRaw);
  const h2hRaw = await get<RawFixture>("/fixtures/headtohead", {
    h2h: `${fixture.home.id}-${fixture.away.id}`,
    last: 4,
  });

  const headToHead: HeadToHeadMeeting[] = await Promise.all(
    h2hRaw.map(async (raw) => {
      const meetingFixture = toSportFixture(raw);
      const stats = await fetchFixtureStats(raw.fixture.id, meetingFixture.home.id, meetingFixture.away.id);
      return { fixture: meetingFixture, stats };
    }),
  );

  return { fixture, headToHead };
}
