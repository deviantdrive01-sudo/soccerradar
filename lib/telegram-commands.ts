import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, sendTelegramPhoto, type TelegramUpdate, type TelegramUser } from "@/lib/telegram";
import { computeAccuracy, accuracyPct } from "@/lib/accuracy";
import { gradePicks, tallyGraded } from "@/lib/booking-grading";
import { isPredicted, type Prediction } from "@/lib/supabase/types";
import type { MarketKey } from "@/lib/hydrate";
import { TOP_MARKET_CONFIGS, filterTopMarketPicks, type TopMarketSlug } from "@/lib/top-market-picks";

const WEBSITE_URL = "https://socceradar.site";
const SIGNUP_URL = `${WEBSITE_URL}/signup`;
const LINK_URL = `${WEBSITE_URL}/account/telegram`;
const GROUP_URL = "https://t.me/+H6oWa-TxFB8xZmM8";

const COMMAND_LIST = `/predictions - Today's top predictions
/topmarkets - See all curated market categories
/search <team> - Find a team's predictions
/mymixes - Your mixes and how they're grading
/stats - Site-wide prediction accuracy
/leaderboard - Top public mixes
/faq - Common questions
/website - Open the SoccerRadar website
/group - Join the community discussion
/help - Show this list`;

// Generated from TOP_MARKET_CONFIGS rather than hand-listed, so a new
// category added there shows up here automatically.
const TOP_MARKETS_LIST = `📊 Curated market categories:\n\n${Object.values(TOP_MARKET_CONFIGS)
  .map((c) => `/${c.command} - ${c.title}`)
  .join("\n")}`;

const NOT_LINKED_MESSAGE = `Don't have a SoccerRadar account yet? Create one free: ${SIGNUP_URL}\n\nAlready have one? Link it here: ${LINK_URL}`;

const FAQ_TEXT = `❓ FAQ

Q: What is SoccerRadar?
A: AI-generated football predictions across outcome, goals, corners, clean sheets and more — with every call graded publicly against what actually happened.

Q: How confident are the predictions?
A: Each market gets its own confidence score, not one number for the whole match — see a match page on the site for the full breakdown.

Q: What's a Mix?
A: A custom prediction list — pick specific markets (like "Over 1.5 Goals") from different matches and combine them into one shareable list.

Q: Can I disagree with a prediction?
A: Yes — when adding a pick to a Mix, you can choose a different outcome than SoccerRadar's own call.

Q: Is it free?
A: Yes, no account needed to browse. An account lets you save mixes, collections, and link Telegram.

Q: How accurate is it really?
A: Every prediction is graded against the real result at ${WEBSITE_URL}/accuracy — nothing held back.

Q: Where do people actually discuss picks?
A: The community group: ${GROUP_URL}

Don't have an account yet? ${SIGNUP_URL}`;

function commandAndArg(text: string): { command: string; arg: string | null } {
  const trimmed = text.trim();
  const spaceIndex = trimmed.indexOf(" ");
  const first = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
  const rest = spaceIndex === -1 ? null : trimmed.slice(spaceIndex + 1).trim() || null;
  // Telegram commands can be suffixed with @BotUsername in group chats — strip it.
  const command = first.split("@")[0].toLowerCase();
  return { command, arg: rest };
}

async function handleLink(chatId: number, code: string | null): Promise<string> {
  if (!code) {
    return "Send this as `/link <code>` with the code shown on your SoccerRadar account page.";
  }

  const supabase = createAdminSupabaseClient();
  const { data: link } = await supabase
    .from("telegram_links")
    .select("id, user_id, code_expires_at, linked_at")
    .eq("link_code", code)
    .maybeSingle();

  if (!link || link.linked_at !== null || !link.code_expires_at || new Date(link.code_expires_at) < new Date()) {
    return "❌ That code is invalid or expired — generate a new one on the website.";
  }

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", link.user_id).maybeSingle();

  const { error } = await supabase
    .from("telegram_links")
    .update({ chat_id: chatId, linked_at: new Date().toISOString(), link_code: null, code_expires_at: null })
    .eq("id", link.id);

  if (error) return "Something went wrong linking your account — please try again.";

  return `✅ Linked to @${profile?.username ?? "your account"}! Try /mymixes or /stats.`;
}

export type PredictionSummary = Pick<Prediction, "id" | "home_team" | "away_team" | "markets" | "confidence">;

/**
 * One match per entry, each with its own link — Telegram auto-linkifies a
 * bare URL on its own line, no parse_mode needed. showConfidence defaults to
 * true for the interactive /predictions command; scheduled broadcast call
 * sites pass false — that content shouldn't surface the model's confidence
 * number per direct instruction (2026-09-08).
 */
export function formatPredictionLines(predictions: PredictionSummary[], { showConfidence = true }: { showConfidence?: boolean } = {}): string {
  return predictions
    .map((p) => `${p.home_team} vs ${p.away_team} — ${p.markets!.outcome.label}${showConfidence ? ` (${p.confidence}%)` : ""}\n${WEBSITE_URL}/match/${p.id}`)
    .join("\n\n");
}

const TOP_PICKS_IMAGE_URL = `${WEBSITE_URL}/api/telegram/top-picks-image`;

/**
 * Sends the branded top-picks image (same ShareImageTemplate used for
 * bookings/collections/top-picks share previews) as a photo, then the full
 * list as a follow-up text message. Two messages rather than one photo+caption
 * so the text list isn't constrained by Telegram's much shorter (1024-char)
 * caption limit.
 */
async function sendPredictionsDigest(chatId: number): Promise<void> {
  const supabase = createAdminSupabaseClient();
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
  if (predictions.length === 0) {
    await sendTelegramMessage(chatId, "No upcoming predictions in the next 24h yet — check back soon.");
    return;
  }

  await sendTelegramPhoto(chatId, TOP_PICKS_IMAGE_URL, "⚽ Today's Top Picks");
  await sendTelegramMessage(chatId, formatPredictionLines(predictions));
}

/** Same two-message pattern as sendPredictionsDigest, for one of the curated per-market categories (lib/top-market-picks.ts). */
async function sendTopMarketDigest(chatId: number, slug: TopMarketSlug): Promise<void> {
  const config = TOP_MARKET_CONFIGS[slug];
  const supabase = createAdminSupabaseClient();
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

  const picks = filterTopMarketPicks((predictions ?? []) as Prediction[], leagueById, config);
  if (picks.length === 0) {
    await sendTelegramMessage(chatId, `No ${config.title} picks at ${config.minConfidence}%+ confidence right now — check back soon.`);
    return;
  }

  const lines = picks
    .slice(0, 8)
    .map((p) => `${p.home_team} vs ${p.away_team} — ${p.label} (${p.confidence}%)\n${WEBSITE_URL}/match/${p.id}`)
    .join("\n\n");

  await sendTelegramPhoto(chatId, `${TOP_PICKS_IMAGE_URL}?market=${slug}`, `⚽ ${config.title}`);
  await sendTelegramMessage(chatId, lines);
}

/** Strips characters that would break PostgREST's `.or()`/`.in()` filter syntax — same as app/api/search/route.ts. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, "").trim();
}

async function handleSearch(query: string | null): Promise<string> {
  const q = query ? sanitizeSearchTerm(query) : "";
  if (q.length === 0) return "Send this as `/search <team name>`, e.g. `/search Arsenal`.";

  const supabase = createAdminSupabaseClient();

  const { data: matchingLeagues } = await supabase.from("leagues").select("id").or(`name.ilike.%${q}%,country.ilike.%${q}%`);
  const leagueIds = (matchingLeagues ?? []).map((l) => l.id);

  const orClauses = [`home_team.ilike.%${q}%`, `away_team.ilike.%${q}%`];
  if (leagueIds.length > 0) orClauses.push(`league_id.in.(${leagueIds.join(",")})`);

  const { data } = await supabase
    .from("predictions")
    .select("id, home_team, away_team, markets, confidence")
    .or(orClauses.join(","))
    .not("markets", "is", null)
    .order("match_date", { ascending: true })
    .limit(8);

  const predictions = (data ?? []) as PredictionSummary[];
  if (predictions.length === 0) return `No predictions found for "${q}".`;

  return `Results for "${q}":\n\n${formatPredictionLines(predictions)}`;
}

async function findLinkedUserId(chatId: number): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle();
  return data?.user_id ?? null;
}

async function handleMyMixes(chatId: number): Promise<string> {
  const userId = await findLinkedUserId(chatId);
  if (!userId) return NOT_LINKED_MESSAGE;

  const supabase = createAdminSupabaseClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!bookings || bookings.length === 0) return "You don't have any mixes yet.";

  const bookingIds = bookings.map((b) => b.id);
  const { data: items } = await supabase
    .from("booking_items")
    .select("booking_id, prediction_id, market_key, user_value")
    .in("booking_id", bookingIds);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } = predictionIds.length > 0 ? await supabase.from("predictions").select("*").in("id", predictionIds) : { data: [] };
  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p as Prediction]));

  const lines = bookings.map((b) => {
    const picks = (items ?? [])
      .filter((i) => i.booking_id === b.id)
      .map((i) => ({ prediction: predictionById.get(i.prediction_id), marketKey: i.market_key as MarketKey, userValue: i.user_value }))
      .filter((p): p is { prediction: Prediction; marketKey: MarketKey; userValue: string | null } => !!p.prediction && isPredicted(p.prediction));

    const tally = tallyGraded(gradePicks(picks));
    const record = tally.settled > 0 ? ` — ${tally.correct}/${tally.settled} won` : "";
    return `${b.title}${record}`;
  });

  return `Your mixes:\n\n${lines.join("\n")}`;
}

async function handleStats(): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from("predictions").select("*").not("actual_result", "is", null);

  const summary = computeAccuracy((data ?? []) as Prediction[]);
  if (summary.totalSettled === 0) return "No settled predictions yet.";

  const overallPct = accuracyPct(summary.overallCorrect, summary.overallKnown);
  const marketLines = summary.perMarket
    .filter((m) => m.known > 0)
    .sort((a, b) => accuracyPct(b.correct, b.known) - accuracyPct(a.correct, a.known))
    .map((m) => `${m.label}: ${accuracyPct(m.correct, m.known)}%`);

  return `Overall accuracy: ${overallPct}% (${summary.totalSettled} settled matches)\n\n${marketLines.join("\n")}\n\nFull breakdown: ${WEBSITE_URL}/accuracy`;
}

async function handleLeaderboard(): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, title")
    .eq("is_public", true)
    .order("published_at", { ascending: false })
    .limit(50);

  if (!bookings || bookings.length === 0) return "No public bookings yet.";

  const userIds = [...new Set(bookings.map((b) => b.user_id))];
  const bookingIds = bookings.map((b) => b.id);

  const [{ data: profiles }, { data: items }] = await Promise.all([
    supabase.from("profiles").select("id, username").in("id", userIds),
    supabase.from("booking_items").select("booking_id, prediction_id, market_key, user_value").in("booking_id", bookingIds),
  ]);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } = predictionIds.length > 0 ? await supabase.from("predictions").select("*").in("id", predictionIds) : { data: [] };
  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p as Prediction]));
  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const ranked = bookings
    .map((b) => {
      const picks = (items ?? [])
        .filter((i) => i.booking_id === b.id)
        .map((i) => ({ prediction: predictionById.get(i.prediction_id), marketKey: i.market_key as MarketKey, userValue: i.user_value }))
        .filter((p): p is { prediction: Prediction; marketKey: MarketKey; userValue: string | null } => !!p.prediction && isPredicted(p.prediction));
      const tally = tallyGraded(gradePicks(picks));
      return { title: b.title, username: usernameById.get(b.user_id) ?? "someone", tally };
    })
    .filter((b) => b.tally.settled > 0)
    .sort((a, b) => accuracyPct(b.tally.correct, b.tally.settled) - accuracyPct(a.tally.correct, a.tally.settled))
    .slice(0, 10);

  if (ranked.length === 0) return "No graded public bookings yet.";

  const lines = ranked.map(
    (b, i) => `${i + 1}. ${b.title} (@${b.username}) — ${b.tally.correct}/${b.tally.settled} · ${accuracyPct(b.tally.correct, b.tally.settled)}%`,
  );
  return `Top public mixes:\n\n${lines.join("\n")}\n\n${WEBSITE_URL}/top-mixes`;
}

function welcomeText(names?: string[]): string {
  const heading = names && names.length > 0 ? `Welcome, ${names.join(", ")}!` : "Welcome to SoccerRadar!";
  return `${heading}
You've just joined 10K+ football enthusiasts who predict smarter every day.

Here's what you can do right now:

${COMMAND_LIST}

Don't have an account yet? Create one free: ${SIGNUP_URL}`;
}

async function handleNewChatMembers(chatId: number, members: TelegramUser[]): Promise<void> {
  const names = members.filter((m) => !m.is_bot).map((m) => m.first_name);
  if (names.length === 0) return; // only the bot itself joined — nothing to greet

  await sendTelegramMessage(chatId, welcomeText(names));
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  if (message.new_chat_members && message.new_chat_members.length > 0) {
    await handleNewChatMembers(message.chat.id, message.new_chat_members);
    return;
  }

  if (!message.text) return;

  const chatId = message.chat.id;
  const { command, arg } = commandAndArg(message.text);

  // Every /topX command (there are 17 as of 2026-09-08 and growing) is
  // dispatched generically from TOP_MARKET_CONFIGS rather than as a manual
  // switch case each — keeps the command list and the router in sync by
  // construction instead of by remembering to update both.
  const topMarketEntry = Object.entries(TOP_MARKET_CONFIGS).find(([, config]) => `/${config.command}` === command);
  if (topMarketEntry) {
    await sendTopMarketDigest(chatId, topMarketEntry[0] as TopMarketSlug);
    return;
  }

  let reply: string;
  switch (command) {
    case "/start":
      reply = arg ? await handleLink(chatId, arg) : welcomeText();
      break;
    case "/link":
      reply = await handleLink(chatId, arg);
      break;
    case "/help":
      reply = COMMAND_LIST;
      break;
    case "/faq":
      reply = FAQ_TEXT;
      break;
    case "/website":
      reply = `⚽ ${WEBSITE_URL}`;
      break;
    case "/group":
      reply = `💬 ${GROUP_URL}`;
      break;
    case "/topmarkets":
      reply = TOP_MARKETS_LIST;
      break;
    case "/predictions":
      await sendPredictionsDigest(chatId);
      return;
    case "/search":
      reply = await handleSearch(arg);
      break;
    case "/mymixes":
      reply = await handleMyMixes(chatId);
      break;
    case "/stats":
      reply = await handleStats();
      break;
    case "/leaderboard":
      reply = await handleLeaderboard();
      break;
    default:
      return; // Not a recognized command — stay quiet rather than noise a group chat.
  }

  await sendTelegramMessage(chatId, reply);
}
