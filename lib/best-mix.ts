import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MARKET_KEYS, marketConfidence, type MarketKey } from "@/lib/hydrate";
import { dateKey, todayKey } from "@/lib/date-key";
import { isPredicted, type Prediction } from "@/lib/supabase/types";

const MIN_TOTAL_PICKS = 3; // not worth publishing a near-empty mix on a quiet day

const CANDIDATE_MARKET_KEYS = MARKET_KEYS;

const SYSTEM_USERNAME = "SoccerRadarOfficial";
const SYSTEM_EMAIL = "official+bestmix@socceradar.site";

interface GenerateOptions {
  minConfidence: number;
  picksPerBooking: number;
  titlePrefix: string;
  /** false (Best Mix): chunk every qualifying pick into as many bookings as needed. true (Banger): keep only the top picksPerBooking picks, one booking, drop the rest. */
  singleBooking: boolean;
}

const BEST_MIX_OPTIONS: GenerateOptions = { minConfidence: 68, picksPerBooking: 7, titlePrefix: "Best Mix", singleBooking: false };
const BANGER_OPTIONS: GenerateOptions = { minConfidence: 60, picksPerBooking: 6, titlePrefix: "Today's Banger", singleBooking: true };

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

/** One pick per match — its single highest-confidence market that clears minConfidence — so a slip is diversified across matches rather than stacked on one. */
function selectQualifyingPicks(predictions: Prediction[], minConfidence: number): QualifyingPick[] {
  const picks: QualifyingPick[] = [];

  for (const p of predictions) {
    if (!isPredicted(p)) continue;
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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
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
 * Scans today's predicted matches for markets clearing options.minConfidence,
 * one pick per match, and bundles them into one or more public Bookings of
 * up to options.picksPerBooking picks each, owned by a dedicated system
 * account. Every call creates fresh bookings — repeated runs the same day
 * are expected as more matches get predicted, and old ones can be deleted
 * from the admin bookings list like any other.
 */
async function generateAutoBooking(options: GenerateOptions): Promise<GenerateBestMixResult | { error: string }> {
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

  const qualifying = selectQualifyingPicks(todaysPredictions, options.minConfidence);
  if (qualifying.length < MIN_TOTAL_PICKS) {
    return { error: `Only ${qualifying.length} match(es) qualify at ${options.minConfidence}%+ today — need at least ${MIN_TOTAL_PICKS}.` };
  }

  const systemUserId = await getOrCreateSystemUserId(supabase);
  const dateLabel = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const chunks = options.singleBooking ? [qualifying.slice(0, options.picksPerBooking)] : chunk(qualifying, options.picksPerBooking);
  const bookings: GeneratedBooking[] = [];

  for (const [index, picks] of chunks.entries()) {
    const title = index === 0 ? `${options.titlePrefix} · ${dateLabel}` : `${options.titlePrefix} · ${dateLabel} (${index + 1})`;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({ user_id: systemUserId, title, is_public: true, published_at: now.toISOString() })
      .select("id")
      .single();

    if (bookingError || !booking) continue;

    await supabase.from("booking_items").insert(
      picks.map((p) => ({
        booking_id: booking.id,
        prediction_id: p.prediction.id,
        market_key: p.marketKey,
        user_value: null,
      })),
    );

    bookings.push({ bookingId: booking.id, title, pickCount: picks.length });
  }

  return { bookings, totalQualifyingMatches: qualifying.length };
}

/** The existing admin-triggered Best Mix generator — 68%+, chunked into as many 7-pick bookings as qualify. Unchanged behavior. */
export async function generateBestMix(): Promise<GenerateBestMixResult | { error: string }> {
  return generateAutoBooking(BEST_MIX_OPTIONS);
}

/** The scheduled "Today's Banger" broadcast — 60%+, a single booking capped at 6 picks (extras beyond the top 6 are dropped, not chunked into a second booking). */
export async function generateTodaysBanger(): Promise<GenerateBestMixResult | { error: string }> {
  return generateAutoBooking(BANGER_OPTIONS);
}
