import "server-only";
import { footballApiKey } from "./api-sports-key";
import { competitionsForSport } from "./competitions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SportFixtureRow, FixtureStatsRow } from "@/lib/supabase/types";
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
// hard to keep API-Football call volume sane while it's still cold (not yet
// in our own archive below).
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

// --- Unified match record: works for both freshly-fetched API data and
// archived DB rows, so the streak engine doesn't care which one it got. ---
interface MatchRecord {
  fixtureId: number;
  competition: { id: number; name: string; country?: string; logo?: string };
  kickoff: string;
  statusState: FixtureState;
  statusLabel: string;
  statusClock: string | null;
  home: { id: number; name: string; logo?: string; score: number | null; htScore: number | null };
  away: { id: number; name: string; logo?: string; score: number | null; htScore: number | null };
}

function toMatchRecord(raw: RawFixture): MatchRecord {
  const { short, long, elapsed } = raw.fixture.status;
  return {
    fixtureId: raw.fixture.id,
    competition: { id: raw.league.id, name: raw.league.name, country: raw.league.country, logo: raw.league.logo },
    kickoff: raw.fixture.date,
    statusState: toFixtureState(short),
    statusLabel: long,
    statusClock: elapsed != null ? `${elapsed}'` : null,
    home: {
      id: raw.teams.home.id,
      name: raw.teams.home.name,
      logo: raw.teams.home.logo,
      score: raw.goals.home,
      htScore: raw.score.halftime.home,
    },
    away: {
      id: raw.teams.away.id,
      name: raw.teams.away.name,
      logo: raw.teams.away.logo,
      score: raw.goals.away,
      htScore: raw.score.halftime.away,
    },
  };
}

function toSportFixture(m: MatchRecord): SportFixture {
  return {
    id: `football:${m.fixtureId}`,
    sport: "football",
    competition: m.competition,
    kickoff: m.kickoff,
    status: { state: m.statusState, label: m.statusLabel, clock: m.statusClock },
    home: { id: m.home.id, name: m.home.name, logo: m.home.logo, score: m.home.score },
    away: { id: m.away.id, name: m.away.name, logo: m.away.logo, score: m.away.score },
  };
}

// --- Archive (Supabase `sport_fixtures`/`fixture_stats`) ---
// A finished fixture's result/stats never change, so once it's archived we
// never call API-Football for it again — only fixtures we haven't seen yet
// (a team/matchup with no archive rows) fall back to the live API, which
// then backfills the archive for next time. All archive I/O is best-effort:
// it's a cache, not a source of truth, so a failure (including the
// migration not having been applied yet) just means "treat as cold start"
// rather than breaking the feature.

function rowToMatchRecord(row: SportFixtureRow): MatchRecord {
  return {
    fixtureId: Number(row.id.split(":")[1]),
    competition: {
      id: row.competition_id,
      name: row.competition_name,
      country: row.competition_country ?? undefined,
      logo: row.competition_logo ?? undefined,
    },
    kickoff: row.kickoff,
    statusState: row.status_state as FixtureState,
    statusLabel: row.status_label,
    statusClock: row.status_clock,
    home: {
      id: row.home_team_id,
      name: row.home_team_name,
      logo: row.home_team_logo ?? undefined,
      score: row.home_score,
      htScore: row.home_ht_score,
    },
    away: {
      id: row.away_team_id,
      name: row.away_team_name,
      logo: row.away_team_logo ?? undefined,
      score: row.away_score,
      htScore: row.away_ht_score,
    },
  };
}

function matchRecordToRow(m: MatchRecord) {
  return {
    id: `football:${m.fixtureId}`,
    sport: "football",
    competition_id: m.competition.id,
    competition_name: m.competition.name,
    competition_country: m.competition.country ?? null,
    competition_logo: m.competition.logo ?? null,
    kickoff: m.kickoff,
    status_state: m.statusState,
    status_label: m.statusLabel,
    status_clock: m.statusClock,
    home_team_id: m.home.id,
    home_team_name: m.home.name,
    home_team_logo: m.home.logo ?? null,
    home_score: m.home.score,
    home_ht_score: m.home.htScore,
    away_team_id: m.away.id,
    away_team_name: m.away.name,
    away_team_logo: m.away.logo ?? null,
    away_score: m.away.score,
    away_ht_score: m.away.htScore,
    updated_at: new Date().toISOString(),
  };
}

async function archiveMatches(records: MatchRecord[]): Promise<void> {
  if (records.length === 0) return;
  try {
    const supabase = createAdminSupabaseClient();
    await supabase.from("sport_fixtures").upsert(records.map(matchRecordToRow));
  } catch {
    // Best-effort cache write — the live feature still works without it.
  }
}

async function archivedMatchesForTeam(teamId: number, venue: "home" | "away", limit: number): Promise<MatchRecord[]> {
  try {
    const supabase = createAdminSupabaseClient();
    const column = venue === "home" ? "home_team_id" : "away_team_id";
    const { data } = await supabase
      .from("sport_fixtures")
      .select("*")
      .eq("sport", "football")
      .eq(column, teamId)
      .eq("status_state", "finished")
      .order("kickoff", { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToMatchRecord);
  } catch {
    return [];
  }
}

async function archivedHeadToHead(homeId: number, awayId: number, limit: number): Promise<MatchRecord[]> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("sport_fixtures")
      .select("*")
      .eq("sport", "football")
      .eq("status_state", "finished")
      .or(`and(home_team_id.eq.${homeId},away_team_id.eq.${awayId}),and(home_team_id.eq.${awayId},away_team_id.eq.${homeId})`)
      .order("kickoff", { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToMatchRecord);
  } catch {
    return [];
  }
}

function statsRowToHeadToHeadStats(row: FixtureStatsRow): HeadToHeadStats {
  return {
    shots: { home: row.home_shots, away: row.away_shots },
    corners: { home: row.home_corners, away: row.away_corners },
    cards: { home: row.home_cards, away: row.away_cards },
  };
}

async function archivedStats(fixtureId: number): Promise<HeadToHeadStats | null> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("fixture_stats")
      .select("*")
      .eq("fixture_id", `football:${fixtureId}`)
      .maybeSingle();
    return data ? statsRowToHeadToHeadStats(data) : null;
  } catch {
    return null;
  }
}

async function archiveStats(fixtureId: number, stats: HeadToHeadStats): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    await supabase.from("fixture_stats").upsert({
      fixture_id: `football:${fixtureId}`,
      home_shots: stats.shots.home,
      away_shots: stats.shots.away,
      home_corners: stats.corners.home,
      away_corners: stats.corners.away,
      home_cards: stats.cards.home,
      away_cards: stats.cards.away,
      fetched_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort cache write.
  }
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

/** Per-team shots/corners/cards for one past fixture, archive-first — null when the provider has no stats for it (common for older/lower-tier matches). */
async function fetchFixtureStats(fixtureId: number, homeId: number, awayId: number): Promise<HeadToHeadStats | null> {
  const cached = await archivedStats(fixtureId);
  if (cached) return cached;

  const stats = await get<RawTeamStatistics>("/fixtures/statistics", { fixture: fixtureId }, HISTORICAL_SECONDS);
  if (stats.length === 0) return null;

  const result: HeadToHeadStats = {
    shots: { home: statValue(stats, homeId, "Total Shots"), away: statValue(stats, awayId, "Total Shots") },
    corners: { home: statValue(stats, homeId, "Corner Kicks"), away: statValue(stats, awayId, "Corner Kicks") },
    cards: { home: cardCount(stats, homeId), away: cardCount(stats, awayId) },
  };
  await archiveStats(fixtureId, result);
  return result;
}

/** All currently live football fixtures across our curated competitions. */
export async function fetchLiveFootballFixtures(): Promise<SportFixture[]> {
  const leagueIds = competitionsForSport("football").map((c) => c.apiLeagueId);
  const raw = await get<RawFixture>("/fixtures", { live: leagueIds.join("-") }, LIVE_SECONDS);
  const records = raw.map(toMatchRecord);
  await archiveMatches(records);
  return records.map(toSportFixture);
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
  const records = results.flat().map(toMatchRecord);
  await archiveMatches(records);
  return records.map(toSportFixture);
}

// --- Match Streak: a deterministic, stats-only engine (no LLM involved) ---
// Every market below is a plain statistical rate computed from each team's
// own last 5 matches at the relevant venue (home team's home games, away
// team's away games), weighted so the most recent match counts more than
// the oldest. Thresholds (corners/cards/shots lines) are calibration
// constants — reasonable defaults, worth revisiting once results can be
// checked against the existing /accuracy tracking. They drive the
// computation only — never shown as literal odds-style lines in the UI.
const FORM_SAMPLE_SIZE = 5;
const FORM_LOOKBACK = 15; // fetched (on a cold start) to have enough matches left after filtering by venue
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

async function toFormMatchRecord(m: MatchRecord, venue: "home" | "away"): Promise<FormMatchRecord> {
  const forGoals = venue === "home" ? m.home.score : m.away.score;
  const againstGoals = venue === "home" ? m.away.score : m.home.score;
  const result: FormMatchRecord["result"] =
    forGoals == null || againstGoals == null ? "D" : forGoals > againstGoals ? "W" : forGoals < againstGoals ? "L" : "D";

  const halfTimeDraw = m.home.htScore != null && m.away.htScore != null && m.home.htScore === m.away.htScore;
  const totalGoals = (m.home.score ?? 0) + (m.away.score ?? 0);
  const btts = (m.home.score ?? 0) > 0 && (m.away.score ?? 0) > 0;

  const stats = await fetchFixtureStats(m.fixtureId, m.home.id, m.away.id);
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

interface TeamForm {
  stats: TeamFormStats;
  records: FormMatchRecord[];
}

async function computeTeamFormStats(teamId: number, venue: "home" | "away"): Promise<TeamForm> {
  let matches = await archivedMatchesForTeam(teamId, venue, FORM_SAMPLE_SIZE);

  if (matches.length < FORM_SAMPLE_SIZE) {
    const recent = await get<RawFixture>("/fixtures", { team: teamId, last: FORM_LOOKBACK }, HOUR_SECONDS);
    const finished = recent.filter((f) => FINISHED_SHORT_CODES.has(f.fixture.status.short)).map(toMatchRecord);
    await archiveMatches(finished);

    matches = finished
      .filter((m) => (venue === "home" ? m.home.id === teamId : m.away.id === teamId))
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, FORM_SAMPLE_SIZE);
  }

  const records = await Promise.all(matches.map((m) => toFormMatchRecord(m, venue)));

  const stats: TeamFormStats = {
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

  return { stats, records };
}

/** "3/5" — a plain count of how many of the considered matches showed this, never a probability/odds figure. */
function streakLabel(records: FormMatchRecord[], predicate: (r: FormMatchRecord) => boolean): string {
  return `${records.filter(predicate).length}/${records.length}`;
}

function resultMarket(home: TeamForm, away: TeamForm): StreakMarket {
  const draw = (home.stats.drawRate + away.stats.drawRate) / 2;
  const max = Math.max(home.stats.winRate, draw, away.stats.winRate);

  if (max === home.stats.winRate) {
    return { key: "result", label: "Match Trend", pick: "Home Leading", streak: streakLabel(home.records, (r) => r.result === "W") };
  }
  if (max === away.stats.winRate) {
    return { key: "result", label: "Match Trend", pick: "Away Leading", streak: streakLabel(away.records, (r) => r.result === "W") };
  }
  const combined = [...home.records, ...away.records];
  return { key: "result", label: "Match Trend", pick: "Even Contest", streak: streakLabel(combined, (r) => r.result === "D") };
}

/**
 * A binary trend pooled across both teams' recent matches (10 max) — the
 * combined-goals/corners/cards/shots markets describe the match as a whole,
 * not one side, so both teams' history is the relevant sample. `available`
 * narrows the pool to matches that actually have that stat, for markets
 * (corners/cards/shots) the provider doesn't always cover.
 */
function binaryMarket(
  key: StreakMarket["key"],
  label: string,
  homeRate: number,
  awayRate: number,
  yesLabel: string,
  noLabel: string,
  pool: FormMatchRecord[],
  predicate: (r: FormMatchRecord) => boolean,
  available?: (r: FormMatchRecord) => boolean,
): StreakMarket {
  const combined = (homeRate + awayRate) / 2;
  const isYes = combined >= 0.5;
  const scoped = available ? pool.filter(available) : pool;
  const streak = streakLabel(scoped, (r) => predicate(r) === isYes);
  return { key, label, pick: isYes ? yesLabel : noLabel, streak };
}

/** The deterministic Match Streak for a fixture — every number here comes straight from recent-form statistics, never from an LLM. */
export async function computeMatchStreak(homeId: number, awayId: number): Promise<MatchStreak | null> {
  const [home, away] = await Promise.all([computeTeamFormStats(homeId, "home"), computeTeamFormStats(awayId, "away")]);
  if (home.stats.sampleSize === 0 && away.stats.sampleSize === 0) return null;

  const pool = [...home.records, ...away.records];

  const markets: StreakMarket[] = [
    resultMarket(home, away),
    binaryMarket(
      "half_time_draw",
      "First-Half Tempo",
      home.stats.halfTimeDrawRate,
      away.stats.halfTimeDrawRate,
      "Tight at the Break",
      "Clear Lead at the Break",
      pool,
      (r) => r.halfTimeDraw,
    ),
    binaryMarket(
      "over_2_5",
      "Goal Trend",
      home.stats.over2_5Rate,
      away.stats.over2_5Rate,
      "Over 2.5 Goals",
      "Under 2.5 Goals",
      pool,
      (r) => r.totalGoals > 2.5,
    ),
    binaryMarket(
      "btts",
      "Scoring Pattern",
      home.stats.bttsRate,
      away.stats.bttsRate,
      "Both Teams Scoring",
      "One-Sided Scoring",
      pool,
      (r) => r.btts,
    ),
    binaryMarket(
      "corners",
      "Corner Activity",
      home.stats.cornersOverRate,
      away.stats.cornersOverRate,
      "Over 9.5 Corners",
      "Under 9.5 Corners",
      pool,
      (r) => r.totalCorners !== null && r.totalCorners > CORNERS_LINE,
      (r) => r.totalCorners !== null,
    ),
    binaryMarket(
      "cards",
      "Discipline Trend",
      home.stats.cardsOverRate,
      away.stats.cardsOverRate,
      "Over 3.5 Cards",
      "Under 3.5 Cards",
      pool,
      (r) => r.totalCards !== null && r.totalCards > CARDS_LINE,
      (r) => r.totalCards !== null,
    ),
    binaryMarket(
      "shots",
      "Shot Volume",
      home.stats.shotsOverRate,
      away.stats.shotsOverRate,
      "Over 23.5 Shots",
      "Under 23.5 Shots",
      pool,
      (r) => r.totalShots !== null && r.totalShots > SHOTS_LINE,
      (r) => r.totalShots !== null,
    ),
    binaryMarket(
      "draw_or_over_2_5",
      "Match Character",
      home.stats.drawOrOver2_5Rate,
      away.stats.drawOrOver2_5Rate,
      "Unpredictable",
      "Comfortable Win Likely",
      pool,
      (r) => r.result === "D" || r.totalGoals > 2.5,
    ),
  ];

  return { markets, home: home.stats, away: away.stats };
}

/** A single fixture's current state, its two teams' 4 most recent meetings, and the computed Match Streak. */
export async function fetchFootballFixtureDetail(fixtureId: number): Promise<FixtureDetail | null> {
  const [fixtureRaw] = await get<RawFixture>("/fixtures", { id: fixtureId }, LIVE_SECONDS);
  if (!fixtureRaw) return null;

  const record = toMatchRecord(fixtureRaw);
  await archiveMatches([record]);
  const fixture = toSportFixture(record);

  let h2hMatches = await archivedHeadToHead(fixture.home.id, fixture.away.id, 4);
  if (h2hMatches.length < 4) {
    const h2hRaw = await get<RawFixture>(
      "/fixtures/headtohead",
      { h2h: `${fixture.home.id}-${fixture.away.id}`, last: 4 },
      HOUR_SECONDS,
    );
    const fetched = h2hRaw.filter((f) => FINISHED_SHORT_CODES.has(f.fixture.status.short)).map(toMatchRecord);
    await archiveMatches(fetched);
    h2hMatches = fetched.sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 4);
  }

  const streak = await computeMatchStreak(fixture.home.id, fixture.away.id);

  const headToHead: HeadToHeadMeeting[] = await Promise.all(
    h2hMatches.map(async (m) => ({ fixture: toSportFixture(m), stats: await fetchFixtureStats(m.fixtureId, m.home.id, m.away.id) })),
  );

  return { fixture, headToHead, streak };
}
