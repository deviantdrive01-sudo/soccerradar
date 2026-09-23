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
