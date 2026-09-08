import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram";
import { MARKET_KEYS, MARKET_LABELS, marketConfidence, marketPredictionLabel } from "@/lib/hydrate";
import { isPredicted, type Prediction } from "@/lib/supabase/types";
import { filterTopMarketPicks, TOP_MARKET_CONFIGS } from "@/lib/top-market-picks";
import { gradePicks, tallyGraded } from "@/lib/booking-grading";
import { buildShareSlug } from "@/lib/share-slug";
import { generateTodaysBanger } from "@/lib/best-mix";
import { todayKey } from "@/lib/date-key";
import { SITE_URL } from "@/lib/site";
import { formatPredictionLines, type PredictionSummary } from "@/lib/telegram-commands";
import type { MarketKey } from "@/lib/hydrate";

export type ScheduledBroadcastType =
  | "general"
  | "top-bookings-1"
  | "top-bookings-2"
  | "top-bookings-3"
  | "banger"
  | "corners"
  | "over15"
  | "international"
  | "top-match";

export interface ScheduledBroadcastResult {
  posted: number;
  reason?: string;
}

/** Display metadata for /admin/telegram — the scheduled time is informational only (the real schedule lives in .github/workflows/telegram-broadcasts.yml + vercel.json), kept here so the admin page has one place to read it from. */
export const SCHEDULED_BROADCAST_INFO: Record<ScheduledBroadcastType, { label: string; scheduledTime: string }> = {
  general: { label: "General Top Picks", scheduledTime: "08:00 UTC" },
  "top-bookings-1": { label: "Top Mix #1", scheduledTime: "08:30 UTC" },
  "top-bookings-2": { label: "Top Mix #2", scheduledTime: "09:00 UTC" },
  "top-bookings-3": { label: "Top Mix #3", scheduledTime: "09:30 UTC" },
  banger: { label: "Today's Mix", scheduledTime: "10:00 UTC" },
  corners: { label: "Today's Corners", scheduledTime: "10:30 UTC" },
  over15: { label: "Today's Over 1.5", scheduledTime: "11:00 UTC" },
  international: { label: "International (Champions League)", scheduledTime: "11:30 UTC" },
  "top-match": { label: "Top Match", scheduledTime: "12:00 UTC" },
};

function channelId(): string {
  const channel = process.env.TELEGRAM_CHANNEL_CHAT_ID;
  if (!channel) throw new Error("TELEGRAM_CHANNEL_CHAT_ID is not set");
  return channel;
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/** Every detail value already logged today for a given category (or category prefix, e.g. "top-bookings-" matches all three slots). */
async function loggedDetailsToday(supabase: AdminClient, categoryPrefix: string): Promise<string[]> {
  const { data } = await supabase
    .from("telegram_broadcast_log")
    .select("detail")
    .eq("broadcast_date", todayKey())
    .like("category", `${categoryPrefix}%`);
  return (data ?? []).map((r) => r.detail).filter((d): d is string => d !== null);
}

async function alreadyLoggedToday(supabase: AdminClient, category: string): Promise<boolean> {
  const { data } = await supabase
    .from("telegram_broadcast_log")
    .select("id")
    .eq("category", category)
    .eq("broadcast_date", todayKey())
    .maybeSingle();
  return data !== null;
}

async function logBroadcast(supabase: AdminClient, category: string, detail: string | null): Promise<void> {
  await supabase.from("telegram_broadcast_log").insert({ category, broadcast_date: todayKey(), detail });
}

const TOP_PICKS_IMAGE_URL = `${SITE_URL}/api/telegram/top-picks-image`;

/** For a single match: its top 3 markets clearing 60% confidence, no numbers shown — falls back to the FT outcome alone if nothing clears the bar. */
function formatMatchTopPicks(p: Prediction, leagueLabel: string): string {
  const markets = p.markets!;
  const ranked = MARKET_KEYS.map((key: MarketKey) => ({
    label: MARKET_LABELS[key],
    value: marketPredictionLabel(markets, key),
    confidence: marketConfidence(markets, key),
  }))
    .filter((m) => m.confidence !== null && m.confidence >= 60)
    .sort((a, b) => b.confidence! - a.confidence!)
    .slice(0, 3);

  const lines = ranked.length > 0 ? ranked.map((m) => `${m.label}: ${m.value}`).join("\n") : `FT: ${markets.outcome.label}`;

  return `⚽ ${p.home_team} vs ${p.away_team}\n${leagueLabel}\n\n${lines}\n\n${SITE_URL}/match/${p.id}`;
}

// ---------------------------------------------------------------------------
// General — the original digest (today's top predictions by blanket
// confidence), unchanged since before the rest of this schedule existed.
// ---------------------------------------------------------------------------

async function broadcastGeneral(supabase: AdminClient): Promise<ScheduledBroadcastResult> {
  if (await alreadyLoggedToday(supabase, "general")) return { posted: 0, reason: "already sent today" };

  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);
  const { data } = await supabase
    .from("predictions")
    .select("id, home_team, away_team, markets, confidence")
    .not("markets", "is", null)
    .gte("match_date", now.toISOString())
    .lte("match_date", dayAhead.toISOString())
    .order("confidence", { ascending: false })
    .limit(8);

  const predictions = (data ?? []) as PredictionSummary[];
  if (predictions.length === 0) return { posted: 0, reason: "no upcoming predictions" };

  await sendTelegramPhoto(channelId(), TOP_PICKS_IMAGE_URL, "⚽ Today's Top Picks");
  await sendTelegramMessage(channelId(), formatPredictionLines(predictions, { showConfidence: false }));
  await logBroadcast(supabase, "general", "daily");
  return { posted: predictions.length };
}

// ---------------------------------------------------------------------------
// Top Bookings — weighted-random pick from public bookings that are still
// mostly actionable, one per slot, excluding whatever the earlier slots
// today already picked so the trio doesn't repeat.
// ---------------------------------------------------------------------------

// A booking's picks must be at least this unplayed to qualify — this is a
// "here's something worth following" post, not a retrospective, so a
// booking whose matches have mostly already kicked off is disqualified
// outright regardless of win rate (2026-09-08 fix: the old logic required
// 3+ settled picks to even be a candidate, which inverted the intent and
// meant only already-finished bookings could ever get selected).
const MIN_UNPLAYED_FRACTION = 0.7;

interface BookingCandidate {
  id: number;
  title: string;
  username: string | null;
  /** Settled-picks win rate, or a neutral 0.5 when nothing has settled yet (the common case now that mostly-unplayed bookings are the target). */
  winRate: number;
}

async function loadBookingCandidates(supabase: AdminClient): Promise<BookingCandidate[]> {
  const { data: bookings } = await supabase.from("bookings").select("id, user_id, title").eq("is_public", true);
  if (!bookings || bookings.length === 0) return [];

  const bookingIds = bookings.map((b) => b.id);
  const userIds = [...new Set(bookings.map((b) => b.user_id))];

  const [{ data: profiles }, { data: items }] = await Promise.all([
    supabase.from("profiles").select("id, username").in("id", userIds),
    supabase.from("booking_items").select("booking_id, prediction_id, market_key, user_value").in("booking_id", bookingIds),
  ]);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } =
    predictionIds.length > 0 ? await supabase.from("predictions").select("*").in("id", predictionIds) : { data: [] as Prediction[] };

  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));
  const itemsByBooking = new Map<number, { prediction_id: number; market_key: string; user_value: string | null }[]>();
  for (const item of items ?? []) {
    const existing = itemsByBooking.get(item.booking_id);
    if (existing) existing.push(item);
    else itemsByBooking.set(item.booking_id, [item]);
  }

  const candidates: BookingCandidate[] = [];
  for (const booking of bookings) {
    const rawItems = itemsByBooking.get(booking.id) ?? [];
    const picks = rawItems
      .map((item): { prediction: Prediction; marketKey: MarketKey; userValue: string | null } | null => {
        const prediction = predictionById.get(item.prediction_id);
        if (!prediction || !isPredicted(prediction)) return null;
        return { prediction, marketKey: item.market_key as MarketKey, userValue: item.user_value };
      })
      .filter((p): p is { prediction: Prediction; marketKey: MarketKey; userValue: string | null } => p !== null);

    if (picks.length === 0) continue;
    const unplayedCount = picks.filter((p) => p.prediction.actual_result === null).length;
    if (unplayedCount / picks.length < MIN_UNPLAYED_FRACTION) continue;

    const { settled, correct } = tallyGraded(gradePicks(picks));

    candidates.push({
      id: booking.id,
      title: booking.title,
      username: usernameById.get(booking.user_id) ?? null,
      winRate: settled > 0 ? correct / settled : 0.5,
    });
  }

  return candidates;
}

function weightedRandomPick(candidates: BookingCandidate[]): BookingCandidate | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => c.winRate + 0.05); // small floor so a 0%-so-far booking isn't literally impossible
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

async function broadcastTopBooking(supabase: AdminClient, category: "top-bookings-1" | "top-bookings-2" | "top-bookings-3"): Promise<ScheduledBroadcastResult> {
  if (await alreadyLoggedToday(supabase, category)) return { posted: 0, reason: "already sent today" };

  const excludeIds = new Set((await loggedDetailsToday(supabase, "top-bookings-")).map(Number));
  const candidates = (await loadBookingCandidates(supabase)).filter((c) => !excludeIds.has(c.id));

  const picked = weightedRandomPick(candidates);
  if (!picked) return { posted: 0, reason: "no eligible bookings (need a public booking that's at least 70% unplayed)" };

  const slug = buildShareSlug(picked.id, picked.username);
  await sendTelegramPhoto(channelId(), `${SITE_URL}/mixes/${picked.id}/opengraph-image`, "🏆 Top Mix");
  await sendTelegramMessage(channelId(), `${picked.title}\n${SITE_URL}/mixes/${slug}`);
  await logBroadcast(supabase, category, String(picked.id));
  return { posted: 1 };
}

// ---------------------------------------------------------------------------
// Today's Banger — a real public booking, same mechanism as Best Mix.
// ---------------------------------------------------------------------------

async function broadcastBanger(supabase: AdminClient): Promise<ScheduledBroadcastResult> {
  if (await alreadyLoggedToday(supabase, "banger")) return { posted: 0, reason: "already sent today" };

  const result = await generateTodaysBanger();
  if ("error" in result) return { posted: 0, reason: result.error };

  const booking = result.bookings[0];
  if (!booking) return { posted: 0, reason: "no booking created" };

  await sendTelegramPhoto(channelId(), `${SITE_URL}/mixes/${booking.bookingId}/opengraph-image`, "🔥 Today's Mix");
  await sendTelegramMessage(channelId(), `${booking.title}\n${SITE_URL}/mixes/${booking.bookingId}`);
  await logBroadcast(supabase, "banger", String(booking.bookingId));
  return { posted: 1 };
}

// ---------------------------------------------------------------------------
// Today's Corners / Today's Over 1.5 — curated per-market digests.
// ---------------------------------------------------------------------------

async function broadcastMarketDigest(
  supabase: AdminClient,
  category: "corners" | "over15",
  slug: "corners" | "over15",
  cap: number,
): Promise<ScheduledBroadcastResult> {
  if (await alreadyLoggedToday(supabase, category)) return { posted: 0, reason: "already sent today" };

  const config = TOP_MARKET_CONFIGS[slug];
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);
  const [{ data: predictions }, { data: leagues }] = await Promise.all([
    supabase
      .from("predictions")
      .select("*")
      .not("markets", "is", null)
      .gte("match_date", now.toISOString())
      .lte("match_date", dayAhead.toISOString())
      .limit(40),
    supabase.from("leagues").select("id, name"),
  ]);
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l.name]));

  const picks = filterTopMarketPicks((predictions ?? []) as Prediction[], leagueById, config).slice(0, cap);
  if (picks.length === 0) return { posted: 0, reason: "no qualifying picks today" };

  const lines = picks.map((p) => `${p.home_team} vs ${p.away_team} — ${p.label}\n${SITE_URL}/match/${p.id}`).join("\n\n");

  await sendTelegramPhoto(channelId(), `${TOP_PICKS_IMAGE_URL}?market=${slug}`, `⚽ ${config.title}`);
  await sendTelegramMessage(channelId(), lines);
  await logBroadcast(supabase, category, "daily");
  return { posted: picks.length };
}

// ---------------------------------------------------------------------------
// International (Champions League) / Top Match (admin-featured) — one
// dedicated post per qualifying match, every match not already sent today.
// ---------------------------------------------------------------------------

async function broadcastMatchDigests(
  supabase: AdminClient,
  category: "international" | "top-match",
  candidates: (Prediction & { leagueLabel: string })[],
): Promise<ScheduledBroadcastResult> {
  const alreadySent = new Set((await loggedDetailsToday(supabase, category)).map(Number));
  const toSend = candidates.filter((p) => !alreadySent.has(p.id));
  if (toSend.length === 0) return { posted: 0, reason: "no new qualifying matches today" };

  for (const p of toSend) {
    await sendTelegramMessage(channelId(), formatMatchTopPicks(p, p.leagueLabel));
    await logBroadcast(supabase, category, String(p.id));
  }
  return { posted: toSend.length };
}

async function broadcastInternational(supabase: AdminClient): Promise<ScheduledBroadcastResult> {
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);
  const [{ data: predictions }, { data: leagues }] = await Promise.all([
    supabase
      .from("predictions")
      .select("*")
      .not("markets", "is", null)
      .gte("match_date", now.toISOString())
      .lte("match_date", dayAhead.toISOString()),
    supabase.from("leagues").select("id, name, country").eq("country", "Europe"),
  ]);

  const europeLeagueIds = new Set((leagues ?? []).map((l) => l.id));
  const leagueNameById = new Map((leagues ?? []).map((l) => [l.id, l.name]));
  const candidates = ((predictions ?? []) as Prediction[])
    .filter((p) => europeLeagueIds.has(p.league_id))
    .map((p) => ({ ...p, leagueLabel: leagueNameById.get(p.league_id) ?? "" }));

  return broadcastMatchDigests(supabase, "international", candidates);
}

async function broadcastTopMatch(supabase: AdminClient): Promise<ScheduledBroadcastResult> {
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);
  const [{ data: predictions }, { data: leagues }] = await Promise.all([
    supabase
      .from("predictions")
      .select("*")
      .not("markets", "is", null)
      .eq("is_featured", true)
      .gte("match_date", now.toISOString())
      .lte("match_date", dayAhead.toISOString()),
    supabase.from("leagues").select("id, name, country"),
  ]);

  const leagueLabelById = new Map((leagues ?? []).map((l) => [l.id, `${l.country} · ${l.name}`]));
  const candidates = ((predictions ?? []) as Prediction[]).map((p) => ({ ...p, leagueLabel: leagueLabelById.get(p.league_id) ?? "" }));

  return broadcastMatchDigests(supabase, "top-match", candidates);
}

// ---------------------------------------------------------------------------

export async function runScheduledBroadcast(type: ScheduledBroadcastType): Promise<ScheduledBroadcastResult> {
  const supabase = createAdminSupabaseClient();
  switch (type) {
    case "general":
      return broadcastGeneral(supabase);
    case "top-bookings-1":
      return broadcastTopBooking(supabase, "top-bookings-1");
    case "top-bookings-2":
      return broadcastTopBooking(supabase, "top-bookings-2");
    case "top-bookings-3":
      return broadcastTopBooking(supabase, "top-bookings-3");
    case "banger":
      return broadcastBanger(supabase);
    case "corners":
      return broadcastMarketDigest(supabase, "corners", "corners", 10);
    case "over15":
      return broadcastMarketDigest(supabase, "over15", "over15", 15);
    case "international":
      return broadcastInternational(supabase);
    case "top-match":
      return broadcastTopMatch(supabase);
  }
}
