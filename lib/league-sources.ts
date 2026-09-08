/**
 * Flashscore source URLs per league, keyed by our `leagues.id`.
 *
 * This is the source of truth for "which Flashscore competition page maps to
 * which of our leagues" — built up over many sessions of trial and error
 * (wrong slugs 404, renamed competitions silently 404 or resolve to the
 * wrong league, etc.), so it should be treated as durable, correctable
 * config rather than rediscovered from scratch each time.
 *
 * `slug` is the Flashscore path segment after /football/, e.g. "germany/bundesliga"
 * — fixtures live at `https://www.flashscore.com/football/{slug}/fixtures/`
 * and results at `https://www.flashscore.com/football/{slug}/results/`.
 *
 * Known naming drift (Flashscore's current name may not match what the
 * competition is colloquially/historically called):
 * - Sweden "Ettan" (3rd tier historically) → now maps to Superettan (2nd tier)
 *   per explicit correction; Flashscore has no page literally named "Ettan".
 * - Sweden "Damallsvenskan" → Flashscore now calls the top women's division
 *   "Allsvenskan Women" (rebranded).
 * - Brazil "Brasileirão Série A" → currently carries a title sponsor on
 *   Flashscore ("serie-a-betano"); sponsor names on lower-profile slugs like
 *   this do change over time, so re-verify if this 404s later.
 * - Argentina "Primera B" → slug is "primera-b", not "primera-b-metropolitana"
 *   (an earlier guess that happened to also resolve, but to the wrong page).
 */
export interface LeagueSource {
  leagueId: number;
  leagueName: string;
  slug: string;
}

export const LEAGUE_SOURCES: LeagueSource[] = [
  { leagueId: 1, leagueName: "Premier League", slug: "england/premier-league" },
  { leagueId: 2, leagueName: "La Liga", slug: "spain/laliga" },
  { leagueId: 3, leagueName: "Serie A", slug: "italy/serie-a" },
  { leagueId: 4, leagueName: "Bundesliga", slug: "germany/bundesliga" },
  { leagueId: 5, leagueName: "Ligue 1", slug: "france/ligue-1" },
  { leagueId: 6, leagueName: "Liga Portugal", slug: "portugal/liga-portugal" },
  { leagueId: 7, leagueName: "Eredivisie", slug: "netherlands/eredivisie" },
  { leagueId: 8, leagueName: "Pro League", slug: "belgium/jupiler-pro-league" },
  { leagueId: 9, leagueName: "Super Lig", slug: "turkey/super-lig" },
  { leagueId: 10, leagueName: "Scottish Premiership", slug: "scotland/premiership" },
  { leagueId: 11, leagueName: "2. Bundesliga", slug: "germany/2-bundesliga" },
  { leagueId: 12, leagueName: "Superliga (Denmark)", slug: "denmark/superliga" },
  { leagueId: 13, leagueName: "Saudi Pro League", slug: "saudi-arabia/saudi-professional-league" },
  { leagueId: 14, leagueName: "MLS", slug: "usa/mls" },
  { leagueId: 15, leagueName: "Super League (Switzerland)", slug: "switzerland/super-league" },
  { leagueId: 16, leagueName: "Superliga (Romania)", slug: "romania/superliga" },
  { leagueId: 17, leagueName: "Brasileirão Série A", slug: "brazil/serie-a-betano" },
  { leagueId: 18, leagueName: "Liga Profesional Argentina", slug: "argentina/liga-profesional" },
  { leagueId: 19, leagueName: "Primera Nacional", slug: "argentina/primera-nacional" },
  { leagueId: 20, leagueName: "Brasileiro Série B", slug: "brazil/serie-b" },
  { leagueId: 21, leagueName: "Primera B", slug: "argentina/primera-b" },
  { leagueId: 22, leagueName: "Primera C", slug: "argentina/primera-c" },
  { leagueId: 23, leagueName: "J1 League", slug: "japan/j1-league" },
  { leagueId: 24, leagueName: "Challenger Pro League", slug: "belgium/challenger-pro-league" },
  { leagueId: 25, leagueName: "Brasileiro Série C", slug: "brazil/serie-c" },
  { leagueId: 26, leagueName: "Brasileiro Série D", slug: "brazil/serie-d" },
  { leagueId: 27, leagueName: "Gaúcho Série A2", slug: "brazil/gaucho-2" },
  { leagueId: 28, leagueName: "Carioca Série B1", slug: "brazil/carioca-b1" },
  { leagueId: 29, leagueName: "Carioca Série B2", slug: "brazil/carioca-b2" },
  { leagueId: 30, leagueName: "HNL", slug: "croatia/hnl" },
  { leagueId: 31, leagueName: "Prva NL", slug: "croatia/prva-nl" },
  { leagueId: 32, leagueName: "Eliteserien", slug: "norway/eliteserien" },
  { leagueId: 33, leagueName: "Ekstraklasa", slug: "poland/ekstraklasa" },
  { leagueId: 34, leagueName: "Ettan", slug: "sweden/superettan" },
  { leagueId: 35, leagueName: "Damallsvenskan", slug: "sweden/allsvenskan-women" },
  { leagueId: 36, leagueName: "Allsvenskan", slug: "sweden/allsvenskan" },
  { leagueId: 37, leagueName: "Challenge League", slug: "switzerland/challenge-league" },
  { leagueId: 38, leagueName: "Champions League", slug: "europe/champions-league" },
  { leagueId: 41, leagueName: "Veikkausliiga", slug: "finland/veikkausliiga" },
  { leagueId: 42, leagueName: "EFL Cup", slug: "england/efl-cup" },
  { leagueId: 43, leagueName: "FA Cup", slug: "england/fa-cup" },
  { leagueId: 44, leagueName: "Championship", slug: "england/championship" },

  // --- Dropped by the user, not yet added to the `leagues` table ---
  // { leagueName: "Cymru Premier (Wales)", slug: "wales/cymru-premier" },
  // { leagueName: "Cymru South (Wales)", slug: "wales/cymru-south" },
  // { leagueName: "Cymru North (Wales)", slug: "wales/cymru-north" },
  // { leagueName: "La Liga 2 (Spain)", slug: "spain/laliga2" },
  // { leagueName: "Ligue 2 (France)", slug: "france/ligue-2" },
  // { leagueName: "League One (England)", slug: "england/league-one" },
  // { leagueName: "League Two (England)", slug: "england/league-two" },
  // { leagueName: "Egypt Premier League", slug: "egypt/premier-league" },
  // { leagueName: "1st Division (Denmark)", slug: "denmark/1st-division" },
  // { leagueName: "2nd Division (Denmark)", slug: "denmark/2nd-division" },
  // { leagueName: "Chance Liga (Czech Republic)", slug: "czech-republic/chance-liga" },
  // { leagueName: "Bundesliga (Austria)", slug: "austria/bundesliga" },
];

export function flashscoreFixturesUrl(slug: string): string {
  return `https://www.flashscore.com/football/${slug}/fixtures/`;
}

export function flashscoreResultsUrl(slug: string): string {
  return `https://www.flashscore.com/football/${slug}/results/`;
}
