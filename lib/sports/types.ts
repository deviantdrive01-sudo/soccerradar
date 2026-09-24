export type Sport = "football" | "basketball";

export type FixtureState = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export interface FixtureStatus {
  state: FixtureState;
  /** Short display label, e.g. "LIVE", "HT", "Q3", "FT", "Final/OT", "Postponed". */
  label: string;
  /** Running clock when live, e.g. "63'" (football) or "04:12" (basketball). Null when not applicable. */
  clock: string | null;
}

export interface FixtureCompetition {
  id: number;
  name: string;
  country?: string;
  logo?: string;
}

export interface FixtureTeam {
  /** Provider's own team id — needed to look up head-to-head history. */
  id: number;
  name: string;
  logo?: string;
  /** Null before the match has any score to report. */
  score: number | null;
}

export interface SportFixture {
  /** `${sport}:${providerId}`, unique across both sports. */
  id: string;
  sport: Sport;
  competition: FixtureCompetition;
  /** ISO kickoff/tip-off timestamp. */
  kickoff: string;
  status: FixtureStatus;
  home: FixtureTeam;
  away: FixtureTeam;
}

export interface HeadToHeadSideStats {
  home: number | null;
  away: number | null;
}

export interface HeadToHeadStats {
  shots: HeadToHeadSideStats;
  corners: HeadToHeadSideStats;
  cards: HeadToHeadSideStats;
}

export interface HeadToHeadMeeting {
  fixture: SportFixture;
  /** Null when the provider has no per-match stats for this meeting (common for older/lower-tier fixtures). */
  stats: HeadToHeadStats | null;
}

export interface FixtureDetail {
  fixture: SportFixture;
  /** Most recent past meetings between these two teams, newest first, capped at 4. */
  headToHead: HeadToHeadMeeting[];
  /** Null when there isn't enough recent-form data for either team to compute anything meaningful. */
  streak: MatchStreak | null;
}

/**
 * A single team's recent-form record at one venue (home team's home
 * matches, away team's away matches) — up to 5 matches, most recent
 * weighted more heavily. Every rate is 0-1.
 */
export interface TeamFormStats {
  /** How many matches this is actually based on (0-5) — fewer means less reliable. */
  sampleSize: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  halfTimeDrawRate: number;
  over2_5Rate: number;
  bttsRate: number;
  cornersOverRate: number;
  cardsOverRate: number;
  shotsOverRate: number;
  drawOrOver2_5Rate: number;
}

/** One computed Match Streak line — purely statistical, no AI judgment involved. */
export interface StreakMarket {
  key: "result" | "half_time_draw" | "over_2_5" | "btts" | "corners" | "cards" | "shots" | "draw_or_over_2_5";
  label: string;
  /** Display value for the pick, e.g. "Home Win", "Over 2.5", "Yes". */
  pick: string;
  /** The statistical rate backing this pick, 0-100. */
  confidence: number;
}

export interface MatchStreak {
  markets: StreakMarket[];
  home: TeamFormStats;
  away: TeamFormStats;
}
