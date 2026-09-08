import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MARKET_KEYS, marketConfidence, type MarketKey } from "@/lib/hydrate";
import { dateKey, todayKey } from "@/lib/date-key";
import { isPredicted, type Prediction } from "@/lib/supabase/types";

const MIN_TOTAL_PICKS = 3; // not worth publishing a near-empty mix on a quiet day

const CANDIDATE_MARKET_KEYS = MARKET_KEYS;

const SYSTEM_USERNAME = "SoccerRadarOfficial";
const SYSTEM_EMAIL = "official+bestmix@socceradar.site";

const BEST_MIX_DEFAULTS = { minConfidence: 68, picksPerBooking: 7, titlePrefix: "Best Mix" };
const BANGER_DEFAULTS = { minConfidence: 60, picksPerBooking: 6, titlePrefix: "Today's Mix" };

/** Admin-supplied overrides for a manual Best Mix generation — every field optional, falling back to BEST_MIX_DEFAULTS. */
export interface GenerateBestMixParams {
  minConfidence?: number;
  picksPerBooking?: number;
  /** Used verbatim if given (no auto date suffix) — falls back to "{prefix} · {date}" when omitted/blank. */
  title?: string;
  /** Restricts candidate matches to these league ids. Empty/omitted = every league. */
  leagueIds?: number[];
}

/** The dedicated account that owns every auto-generated booking (Best Mix, Today's Banger) — created once, reused after. */
async function getOrCreateSystemUserId(supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<string> {
  const { data: existing } = await supabase.from("profiles").select("id").eq("username", SYSTEM_USERNAME).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email: SYSTEM_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { username: SYSTEM_USERNAME },
  });
  if (error || !data.user) throw new Error(`Could not create the system account: ${error?.message ?? "unknown error"}`);
  return data.user.id;
}

interface QualifyingPick {
  prediction: Prediction;
  marketKey: MarketKey;
  confidence: number;
}

/** One pick per match — its single highest-confidence market that clears minConfidence — so a slip is diversified across matches rather than stacked on one. leagueIds, when non-empty, restricts candidates to those leagues. */
function selectQualifyingPicks(predictions: Prediction[], minConfidence: number, leagueIds?: number[]): QualifyingPick[] {
  const picks: QualifyingPick[] = [];
  const leagueFilter = leagueIds && leagueIds.length > 0 ? new Set(leagueIds) : null;

  for (const p of predictions) {
    if (!isPredicted(p)) continue;
    if (leagueFilter && !leagueFilter.has(p.league_id)) continue;
    let best: { marketKey: MarketKey; confidence: number } | null = null;
    for (const key of CANDIDATE_MARKET_KEYS) {
      // FT Draw calls excluded from the candidate pool per direct instruction
      // (2026-09-08) — draws are the least reliable of the three FT results.
      // Home/Away FT calls are fair game now that fullTimeOutcome exists.
      if (key === "fullTimeOutcome" && p.markets.outcome.code === "X") continue;
      const confidence = marketConfidence(p.markets, key);
      if (confidence !== null && confidence >= minConfidence && (!best || confidence > best.confidence)) {
        best = { marketKey: key, confidence };
      }
    }
    if (best) picks.push({ prediction: p, marketKey: best.marketKey, confidence: best.confidence });
  }

  return picks.sort((a, b) => b.confidence - a.confidence);
}

export interface GeneratedBooking {
  bookingId: number;
  title: string;
  pickCount: number;
}

export interface GenerateBestMixResult {
  bookings: GeneratedBooking[];
  totalQualifyingMatches: number;
}

/**
 * Scans today's predicted matches for markets clearing minConfidence
 * (optionally restricted to leagueIds), one pick per match, ranked by
 * confidence, and publishes the top picksPerBooking of them as a single
 * public Booking owned by a dedicated system account — extras beyond the
 * cap are dropped, not chunked into a second booking. Every call creates a
 * fresh booking — repeated runs the same day are expected as more matches
 * get predicted, and old ones can be deleted from the admin bookings list
 * like any other.
 */
async function generateAutoBooking(
  defaults: { minConfidence: number; picksPerBooking: number; titlePrefix: string },
  params: GenerateBestMixParams = {},
): Promise<GenerateBestMixResult | { error: string }> {
  const minConfidence = params.minConfidence ?? defaults.minConfidence;
  const picksPerBooking = params.picksPerBooking ?? defaults.picksPerBooking;

  const supabase = createAdminSupabaseClient();

  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .not("markets", "is", null)
    .gte("match_date", now.toISOString())
    .lte("match_date", dayAhead.toISOString());

  if (error) return { error: error.message };

  const today = todayKey();
  const todaysPredictions = (data ?? []).filter((p) => dateKey(p.match_date) === today);

  const qualifying = selectQualifyingPicks(todaysPredictions, minConfidence, params.leagueIds);
  if (qualifying.length < MIN_TOTAL_PICKS) {
    const scope = params.leagueIds && params.leagueIds.length > 0 ? " in the selected leagues" : "";
    return { error: `Only ${qualifying.length} match(es) qualify at ${minConfidence}%+${scope} today — need at least ${MIN_TOTAL_PICKS}.` };
  }

  const systemUserId = await getOrCreateSystemUserId(supabase);
  const dateLabel = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const title = params.title?.trim() || `${defaults.titlePrefix} · ${dateLabel}`;
  const picks = qualifying.slice(0, picksPerBooking);

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({ user_id: systemUserId, title, is_public: true, published_at: now.toISOString() })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the booking." };
  }

  await supabase.from("booking_items").insert(
    picks.map((p) => ({
      booking_id: booking.id,
      prediction_id: p.prediction.id,
      market_key: p.marketKey,
      user_value: null,
    })),
  );

  return { bookings: [{ bookingId: booking.id, title, pickCount: picks.length }], totalQualifyingMatches: qualifying.length };
}

/** The admin-triggered Best Mix generator — 68%+/7 picks by default, but every field is overridable from the /admin/mixes form (confidence, pick count, title, preferred leagues). */
export async function generateBestMix(params: GenerateBestMixParams = {}): Promise<GenerateBestMixResult | { error: string }> {
  return generateAutoBooking(BEST_MIX_DEFAULTS, params);
}

/** The scheduled "Today's Banger" broadcast — fixed at 60%+/6 picks, no admin input (this one runs unattended on a cron). */
export async function generateTodaysBanger(): Promise<GenerateBestMixResult | { error: string }> {
  return generateAutoBooking(BANGER_DEFAULTS);
}
