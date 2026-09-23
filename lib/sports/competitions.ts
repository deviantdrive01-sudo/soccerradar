import type { Sport } from "./types";

/**
 * Curated set of API-Sports competition/league IDs to show on the Live/
 * Fixtures hub, per sport. These IDs are API-Sports' own numeric league
 * IDs (not our internal `leagues.id`) — a different numbering per sport
 * product (v3.football vs v1.basketball).
 *
 * Best-effort seed values based on API-Sports' well-known IDs for these
 * competitions; verify against a live `/leagues` call for the account's
 * actual API_SPORTS_KEY before relying on this in production (same
 * "durable, correctable config" caveat as `lib/league-sources.ts` — wrong
 * IDs fail soft (empty fixture list for that competition), not hard.
 */
export interface CuratedCompetition {
  sport: Sport;
  apiLeagueId: number;
  name: string;
  country?: string;
}

export const CURATED_COMPETITIONS: CuratedCompetition[] = [
  // Football (v3.football.api-sports.io league IDs)
  { sport: "football", apiLeagueId: 39, name: "Premier League", country: "England" },
  { sport: "football", apiLeagueId: 140, name: "La Liga", country: "Spain" },
  { sport: "football", apiLeagueId: 135, name: "Serie A", country: "Italy" },
  { sport: "football", apiLeagueId: 78, name: "Bundesliga", country: "Germany" },
  { sport: "football", apiLeagueId: 61, name: "Ligue 1", country: "France" },
  { sport: "football", apiLeagueId: 2, name: "Champions League", country: "Europe" },
  { sport: "football", apiLeagueId: 253, name: "MLS", country: "USA" },

  // Basketball (v1.basketball.api-sports.io league IDs)
  { sport: "basketball", apiLeagueId: 12, name: "NBA", country: "USA" },
  { sport: "basketball", apiLeagueId: 120, name: "EuroLeague", country: "Europe" },
];

export function competitionsForSport(sport: Sport): CuratedCompetition[] {
  return CURATED_COMPETITIONS.filter((c) => c.sport === sport);
}
