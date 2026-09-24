import "server-only";
import { footballApiKey } from "./api-sports-key";
import { competitionsForSport } from "./competitions";
import type {
  FixtureDetail,
  HeadToHeadMeeting,
  HeadToHeadStats,
  MatchStreak,
  SportFixture,
  FixtureState,
  StreakMarket,
  TeamFormStats,
} from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

// Live/current-state data needs to be near-real-time; historical data (past
// fixtures' own stats) never changes once the match is over, so it's cached
// hard to keep API-Football call volume sane — a match-detail page load
// touches a couple dozen historical-stats calls (H2H + both teams' recent
// form), and re-fetching those every 30s on live polling would be wasteful.
const LIVE_SECONDS = 30;
const SHORT_SECONDS = 300;
const HOUR_SECONDS = 60 * 60;
const HISTORICAL_SECONDS = 60 * 60 * 12;

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
  score: { halftime: { home: number | null; away: number | null } };
}

async function get<T>(path: string, params: Record<string, string | number>, revalidateSeconds: number): Promise<T[]> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const res = await fetch(url, {
    headers: { "x-apisports-key": footballApiKey() },
    next: { revalidate: revalidateSeconds },
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
  const stats = await get<RawTeamStatistics>("/fixtures/statistics", { fixture: fixtureId }, HISTORICAL_SECONDS);
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
  const raw = await get<RawFixture>("/fixtures", { live: leagueIds.join("-") }, LIVE_SECONDS);
  return raw.map(toSportFixture);
}

/** Football fixtures for a given date (YYYY-MM-DD) across our curated competitions. */
export async function fetchFootballFixturesByDate(date: string): Promise<SportFixture[]> {
  const leagues = competitionsForSport("football");
  const results = await Promise.all(
    leagues.map((league) =>
      get<RawFixture>(
        "/fixtures",
        { date, league: league.apiLeagueId, season: new Date(date).getFullYear() },
        SHORT_SECONDS,
      ),
    ),
  );
  return results.flat().map(toSportFixture);
}

// --- Match Streak: a deterministic, stats-only engine (no LLM involved) ---
// Every market below is a plain statistical rate computed from each team's
// own last 5 matches at the relevant venue (home team's home games, away
// team's away games), weighted so the most recent match counts more than
// the oldest. Thresholds (corners/cards/shots lines) are calibration
// constants — reasonable defaults, worth revisiting once results can be
// checked against the existing /accuracy tracking.
const FORM_SAMPLE_SIZE = 5;
const FORM_LOOKBACK = 15; // fetched to have enough matches left after filtering by venue
const CORNERS_LINE = 9.5;
const CARDS_LINE = 3.5;
const SHOTS_LINE = 23.5;

/** Weighted mean over 0/1 (or numeric) values ordered most-recent-first; the most recent entry gets the highest weight. */
function weightedMean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  let weightTotal = 0;
  values.forEach((v, i) => {
    const weight = values.length - i;
    sum += v * weight;
    weightTotal += weight;
  });
  return sum / weightTotal;
}

interface FormMatchRecord {
  result: "W" | "D" | "L";
  halfTimeDraw: boolean;
  totalGoals: number;
  btts: boolean;
  totalCorners: number | null;
  totalCards: number | null;
  totalShots: number | null;
}

async function toFormMatchRecord(raw: RawFixture, venue: "home" | "away"): Promise<FormMatchRecord> {
  const forGoals = venue === "home" ? raw.goals.home : raw.goals.away;
  const againstGoals = venue === "home" ? raw.goals.away : raw.goals.home;
  const result: FormMatchRecord["result"] =
    forGoals == null || againstGoals == null ? "D" : forGoals > againstGoals ? "W" : forGoals < againstGoals ? "L" : "D";

  const ht = raw.score.halftime;
  const halfTimeDraw = ht.home != null && ht.away != null && ht.home === ht.away;
  const totalGoals = (raw.goals.home ?? 0) + (raw.goals.away ?? 0);
  const btts = (raw.goals.home ?? 0) > 0 && (raw.goals.away ?? 0) > 0;

  const stats = await fetchFixtureStats(raw.fixture.id, raw.teams.home.id, raw.teams.away.id);
  const totalCorners = stats?.corners.home != null && stats.corners.away != null ? stats.corners.home + stats.corners.away : null;
  const totalCards = stats?.cards.home != null && stats.cards.away != null ? stats.cards.home + stats.cards.away : null;
  const totalShots = stats?.shots.home != null && stats.shots.away != null ? stats.shots.home + stats.shots.away : null;

  return { result, halfTimeDraw, totalGoals, btts, totalCorners, totalCards, totalShots };
}

function rate(records: FormMatchRecord[], predicate: (r: FormMatchRecord) => boolean): number {
  return weightedMean(records.map((r) => (predicate(r) ? 1 : 0)));
}

function overRate(records: FormMatchRecord[], pick: (r: FormMatchRecord) => number | null, line: number): number {
  const withStats = records.filter((r) => pick(r) !== null);
  if (withStats.length === 0) return 0;
  return weightedMean(withStats.map((r) => (pick(r)! > line ? 1 : 0)));
}

async function computeTeamFormStats(teamId: number, venue: "home" | "away"): Promise<TeamFormStats> {
  const recent = await get<RawFixture>("/fixtures", { team: teamId, last: FORM_LOOKBACK }, HOUR_SECONDS);
  const venueMatches = recent
    .filter((f) => FINISHED_SHORT_CODES.has(f.fixture.status.short))
    .filter((f) => (venue === "home" ? f.teams.home.id === teamId : f.teams.away.id === teamId))
    .sort((a, b) => b.fixture.date.localeCompare(a.fixture.date))
    .slice(0, FORM_SAMPLE_SIZE);

  const records = await Promise.all(venueMatches.map((raw) => toFormMatchRecord(raw, venue)));

  return {
    sampleSize: records.length,
    winRate: rate(records, (r) => r.result === "W"),
    drawRate: rate(records, (r) => r.result === "D"),
    lossRate: rate(records, (r) => r.result === "L"),
    halfTimeDrawRate: rate(records, (r) => r.halfTimeDraw),
    over2_5Rate: rate(records, (r) => r.totalGoals > 2.5),
    bttsRate: rate(records, (r) => r.btts),
    cornersOverRate: overRate(records, (r) => r.totalCorners, CORNERS_LINE),
    cardsOverRate: overRate(records, (r) => r.totalCards, CARDS_LINE),
    shotsOverRate: overRate(records, (r) => r.totalShots, SHOTS_LINE),
    drawOrOver2_5Rate: rate(records, (r) => r.result === "D" || r.totalGoals > 2.5),
  };
}

function resultMarket(home: TeamFormStats, away: TeamFormStats): StreakMarket {
  const draw = (home.drawRate + away.drawRate) / 2;
  const max = Math.max(home.winRate, draw, away.winRate);
  const pick = max === home.winRate ? "Home Leading" : max === away.winRate ? "Away Leading" : "Even Contest";
  return { key: "result", label: "Match Trend", pick, confidence: Math.round(max * 100) };
}

function binaryMarket(
  key: StreakMarket["key"],
  label: string,
  homeRate: number,
  awayRate: number,
  yesLabel: string,
  noLabel: string,
): StreakMarket {
  const combined = (homeRate + awayRate) / 2;
  const isYes = combined >= 0.5;
  return { key, label, pick: isYes ? yesLabel : noLabel, confidence: Math.round((isYes ? combined : 1 - combined) * 100) };
}

/** The deterministic Match Streak for a fixture — every number here comes straight from recent-form statistics, never from an LLM. */
export async function computeMatchStreak(homeId: number, awayId: number): Promise<MatchStreak | null> {
  const [home, away] = await Promise.all([computeTeamFormStats(homeId, "home"), computeTeamFormStats(awayId, "away")]);
  if (home.sampleSize === 0 && away.sampleSize === 0) return null;

  const markets: StreakMarket[] = [
    resultMarket(home, away),
    binaryMarket(
      "half_time_draw",
      "First-Half Tempo",
      home.halfTimeDrawRate,
      away.halfTimeDrawRate,
      "Tight at the Break",
      "Clear Lead at the Break",
    ),
    binaryMarket("over_2_5", "Goal Trend", home.over2_5Rate, away.over2_5Rate, "High-Scoring", "Low-Scoring"),
    binaryMarket("btts", "Scoring Pattern", home.bttsRate, away.bttsRate, "Both Teams Scoring", "One-Sided Scoring"),
    binaryMarket("corners", "Corner Activity", home.cornersOverRate, away.cornersOverRate, "High Corner Count", "Low Corner Count"),
    binaryMarket("cards", "Discipline Trend", home.cardsOverRate, away.cardsOverRate, "Cards Likely", "Clean Game Likely"),
    binaryMarket("shots", "Shot Volume", home.shotsOverRate, away.shotsOverRate, "High Shot Volume", "Low Shot Volume"),
    binaryMarket(
      "draw_or_over_2_5",
      "Match Character",
      home.drawOrOver2_5Rate,
      away.drawOrOver2_5Rate,
      "Unpredictable",
      "Comfortable Win Likely",
    ),
  ];

  return { markets, home, away };
}

/** A single fixture's current state, its two teams' 4 most recent meetings, and the computed Match Streak. */
export async function fetchFootballFixtureDetail(fixtureId: number): Promise<FixtureDetail | null> {
  const [fixtureRaw] = await get<RawFixture>("/fixtures", { id: fixtureId }, LIVE_SECONDS);
  if (!fixtureRaw) return null;

  const fixture = toSportFixture(fixtureRaw);

  const [h2hRaw, streak] = await Promise.all([
    get<RawFixture>("/fixtures/headtohead", { h2h: `${fixture.home.id}-${fixture.away.id}`, last: 4 }, HOUR_SECONDS),
    computeMatchStreak(fixture.home.id, fixture.away.id),
  ]);

  const headToHead: HeadToHeadMeeting[] = await Promise.all(
    h2hRaw.map(async (raw) => {
      const meetingFixture = toSportFixture(raw);
      const stats = await fetchFixtureStats(raw.fixture.id, meetingFixture.home.id, meetingFixture.away.id);
      return { fixture: meetingFixture, stats };
    }),
  );

  return { fixture, headToHead, streak };
}
