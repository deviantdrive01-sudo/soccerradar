import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { getTeamCrestDataUri } from "@/lib/team-crest";
import { isPredicted } from "@/lib/supabase/types";
import { MARKET_KEYS, marketConfidence, marketPredictionLabel, MARKET_LABELS } from "@/lib/hydrate";
import {
  MatchBestPicksImageTemplate,
  MARKET_DESCRIPTIONS,
  BEST_PICKS_IMAGE_WIDTH,
  BEST_PICKS_IMAGE_OPTIONS_FONTS,
  bestPicksImageHeight,
  type BestPickRow,
} from "@/lib/match-best-picks-image";

export const dynamic = "force-dynamic";

const DEFAULT_TIME_ZONE = "Europe/London";
const MIN_CONFIDENCE = 50;

/** Same validate-before-trust pattern as the other match-image routes. */
function resolveTimeZone(tz: string | null): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Date().toLocaleTimeString("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  const timeZone = resolveTimeZone(req.nextUrl.searchParams.get("tz"));

  const supabase = createSupabaseReadClient();
  const { data: prediction } = await supabase.from("predictions").select("*").eq("id", numericId).maybeSingle();

  if (!prediction || !isPredicted(prediction)) {
    return new Response("Not found", { status: 404 });
  }

  const { data: league } = await supabase.from("leagues").select("name, country").eq("id", prediction.league_id).maybeSingle();

  const [homeCrestUrl, awayCrestUrl] = await Promise.all([
    getTeamCrestDataUri(prediction.home_team),
    getTeamCrestDataUri(prediction.away_team),
  ]);

  const markets = prediction.markets;
  const picks: BestPickRow[] = MARKET_KEYS.map((key) => ({
    title: `${MARKET_LABELS[key]}: ${marketPredictionLabel(markets, key)}`,
    subtitle: MARKET_DESCRIPTIONS[key],
    confidence: marketConfidence(markets, key),
  }))
    .filter((p) => p.confidence !== null && p.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence! - a.confidence!)
    .map((p) => ({ title: p.title, subtitle: p.subtitle }));

  const kickoff = new Date(prediction.match_date);
  const dateLabel = kickoff.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  const timeLabel = kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });

  return new ImageResponse(
    (
      <MatchBestPicksImageTemplate
        homeTeam={prediction.home_team}
        awayTeam={prediction.away_team}
        homeCrestUrl={homeCrestUrl}
        awayCrestUrl={awayCrestUrl}
        leagueLabel={league ? `${league.country} · ${league.name}` : ""}
        kickoffLabel={`${dateLabel}, ${timeLabel}`}
        picks={picks}
      />
    ),
    { width: BEST_PICKS_IMAGE_WIDTH, height: bestPicksImageHeight(picks.length), fonts: BEST_PICKS_IMAGE_OPTIONS_FONTS },
  );
}
