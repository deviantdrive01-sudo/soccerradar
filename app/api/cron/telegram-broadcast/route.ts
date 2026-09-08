import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram";
import { formatPredictionLines, type PredictionSummary } from "@/lib/telegram-commands";
import { SITE_URL } from "@/lib/site";

const TOP_PICKS_IMAGE_URL = `${SITE_URL}/api/telegram/top-picks-image`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = process.env.TELEGRAM_CHANNEL_CHAT_ID;
  if (!channel) {
    return NextResponse.json({ error: "TELEGRAM_CHANNEL_CHAT_ID is not set" }, { status: 500 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);

  const { data, error } = await supabase
    .from("predictions")
    .select("id, home_team, away_team, markets, confidence")
    .not("markets", "is", null)
    .gte("match_date", now.toISOString())
    .lte("match_date", dayAhead.toISOString())
    .order("confidence", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const predictions = (data ?? []) as PredictionSummary[];
  if (predictions.length === 0) {
    return NextResponse.json({ posted: false, reason: "no upcoming predictions" });
  }

  await sendTelegramPhoto(channel, TOP_PICKS_IMAGE_URL, "⚽ Today's Top Picks");
  await sendTelegramMessage(channel, formatPredictionLines(predictions, { showConfidence: false }));

  return NextResponse.json({ posted: true, count: predictions.length });
}
