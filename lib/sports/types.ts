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
}
