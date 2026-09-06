import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AdSlot } from "@/components/ad-slot";
import { ShareButtons } from "@/components/share-buttons";
import { FavoriteButton } from "@/components/favorite-button";
import { SettledMarketBadges } from "@/components/settled-market-badges";
import { isDrawOrOver2_5, isFullTimeDraw, settledMarketTally, summarizeSettledMarkets, winEitherHalfCode } from "@/lib/hydrate";
import { SITE_URL } from "@/lib/site";
import type { Prediction, League } from "@/lib/supabase/types";

export const revalidate = 300;

async function getMatchData(id: number): Promise<{ prediction: Prediction; league: League | null } | null> {
  const supabase = createSupabaseReadClient();
  const { data: prediction } = await supabase.from("predictions").select("*").eq("id", id).maybeSingle();
  if (!prediction) return null;
  const { data: league } = await supabase.from("leagues").select("*").eq("id", prediction.league_id).maybeSingle();
  return { prediction, league: league ?? null };
}

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return { title: "Match not found — SoccerRadar" };

  const data = await getMatchData(numericId);
  if (!data) return { title: "Match not found — SoccerRadar" };

  const { prediction, league } = data;
  const title = `${prediction.home_team} vs ${prediction.away_team} Prediction${league ? ` — ${league.name}` : ""} | SoccerRadar`;
  const description = prediction.summary || `AI-generated prediction for ${prediction.home_team} vs ${prediction.away_team}.`;

  return { title, description };
}

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function YesNoBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <Badge variant="outline" className={value ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}>
      {label} {value ? "✓" : "✗"}
    </Badge>
  );
}

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const data = await getMatchData(numericId);
  if (!data) notFound();
  const { prediction, league } = data;

  const kickoff = new Date(prediction.match_date);
  const markets = prediction.markets;
  const winEitherHalf = winEitherHalfCode(markets);
  const actual = prediction.actual_result;
  const settled = actual
    ? { results: summarizeSettledMarkets(markets, actual.markets), tally: settledMarketTally(summarizeSettledMarkets(markets, actual.markets)) }
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          All predictions
        </Link>
        <div className="flex items-center gap-2">
          <FavoriteButton
            target={{ type: "match", predictionId: prediction.id }}
            className="rounded-md border border-border/60"
          />
          <ShareButtons
            url={`${SITE_URL}/match/${prediction.id}`}
            title={`${prediction.home_team} vs ${prediction.away_team} prediction — SoccerRadar`}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground/80">
          <span>{league?.name ?? "Unknown league"}</span>
          <span>
            {kickoff.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
            {" · "}
            {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 text-2xl font-bold leading-tight">
            {prediction.home_team}
            <span className="mx-2 text-muted-foreground font-medium">vs</span>
            {prediction.away_team}
          </h1>
          <Badge variant="outline" className={confidenceClass(prediction.confidence)}>
            {prediction.confidence}% confidence
          </Badge>
        </div>

        {settled && actual && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Final {actual.raw.finalScore.home}–{actual.raw.finalScore.away}
              </div>
              {settled.tally.known > 0 && (
                <Badge
                  variant="outline"
                  className={
                    settled.tally.correct / settled.tally.known >= 0.5
                      ? "border-emerald-500/30 text-emerald-400"
                      : "border-red-500/30 text-red-400"
                  }
                >
                  {settled.tally.correct}/{settled.tally.known} correct
                </Badge>
              )}
            </div>
            <SettledMarketBadges predicted={markets} actual={actual.markets} />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Outcome</div>
          <div className="flex flex-wrap gap-1.5">
            <YesNoBadge label="FT Draw" value={isFullTimeDraw(markets)} />
            <Badge variant="secondary" className="font-medium">
              1H: {markets.firstHalfOutcome.label}
            </Badge>
            <Badge variant="secondary" className="font-medium">
              {markets.highestScoringHalf.label}
            </Badge>
            <Badge variant="secondary" className="font-medium">
              Win Either Half:{" "}
              {winEitherHalf === null ? "–" : winEitherHalf === "1" ? prediction.home_team : prediction.away_team}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Goals</div>
          <div className="flex flex-wrap gap-1.5">
            <YesNoBadge label="O1.5" value={markets.goals.over1_5} />
            <YesNoBadge label="O2.5" value={markets.goals.over2_5} />
            <YesNoBadge label="Draw/O2.5" value={isDrawOrOver2_5(markets)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Corners</div>
          <div className="flex flex-wrap gap-1.5">
            <YesNoBadge label="O7.5" value={markets.corners.over7_5} />
            <YesNoBadge label="O8.5" value={markets.corners.over8_5} />
            <YesNoBadge label="1H O3.5" value={markets.corners.firstHalfOver3_5} />
          </div>
        </div>

        {prediction.summary && (
          <div className="space-y-1 border-t border-border/60 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Tactical summary</div>
            <p className="text-sm font-medium text-foreground/90">{prediction.summary}</p>
          </div>
        )}
      </div>

      <AdSlot orientation="horizontal" />
    </main>
  );
}
