import "server-only";

/** Football uses the account's existing API-Football key. */
export function footballApiKey(): string {
  const key = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY;
  if (!key) {
    throw new Error("Missing API_FOOTBALL_KEY environment variable");
  }
  return key;
}

/**
 * Basketball is a separate API-Sports product (v1.basketball.api-sports.io)
 * — unlike football, this deliberately does NOT fall back to
 * `API_FOOTBALL_KEY`, since that key isn't confirmed to authorize it.
 * Requires its own `API_SPORTS_KEY`; until that's set, basketball stays
 * disabled in the UI and this throws a clear "not configured" error rather
 * than sending requests with a key that's the wrong product.
 */
export function basketballApiKey(): string {
  const key = process.env.API_SPORTS_KEY;
  if (!key) {
    throw new Error("Missing API_SPORTS_KEY environment variable (basketball isn't configured yet)");
  }
  return key;
}
