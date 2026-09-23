import "server-only";

/**
 * API-Sports direct subscriptions (api-sports.io, not the RapidAPI mirror)
 * use one account key across every sport product (football, basketball,
 * etc.) — so the live-scores feature defaults to a dedicated
 * `API_SPORTS_KEY` but falls back to the existing `API_FOOTBALL_KEY` until
 * that var is added, so nothing breaks on deploy.
 */
export function apiSportsKey(): string {
  const key = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("Missing API_SPORTS_KEY (or API_FOOTBALL_KEY) environment variable");
  }
  return key;
}
