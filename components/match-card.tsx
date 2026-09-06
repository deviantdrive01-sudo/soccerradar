import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isDrawOrOver2_5, isFullTimeDraw, settledMarketTally, summarizeSettledMarkets, winEitherHalfCode } from "@/lib/hydrate";
import { SettledMarketBadges } from "@/components/settled-market-badges";
import { CollectionPickerButton } from "@/components/collection-picker-button";
import type { Prediction } from "@/lib/supabase/types";
import type { MarketFilter } from "@/components/market-filter";
import { ChevronDown } from "lucide-react";

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function BoolBadge({ label, value }: { label: string; value: boolean | null }) {
  return (
    <Badge variant="outline" className={value ? "border-violet-500/30 text-violet-400" : "text-muted-foreground"}>
      {label} {value === null ? "–" : value ? "✓" : "✗"}
    </Badge>
  );
}

function GoalsBadges({ markets }: { markets: Prediction["markets"] }) {
  return (
    <>
      <Badge variant="outline" className={markets.goals.over1_5 ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}>
        O1.5 {markets.goals.over1_5 ? "✓" : "✗"}
      </Badge>
      <Badge variant="outline" className={markets.goals.over2_5 ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}>
        O2.5 {markets.goals.over2_5 ? "✓" : "✗"}
      </Badge>
    </>
  );
}

function CornersBadges({ markets }: { markets: Prediction["markets"] }) {
  return (
    <>
      <Badge variant="outline" className={markets.corners.over7_5 ? "border-sky-500/30 text-sky-400" : "text-muted-foreground"}>
        C7.5 {markets.corners.over7_5 ? "✓" : "✗"}
      </Badge>
      <Badge variant="outline" className={markets.corners.over8_5 ? "border-sky-500/30 text-sky-400" : "text-muted-foreground"}>
        C8.5 {markets.corners.over8_5 ? "✓" : "✗"}
      </Badge>
      <Badge variant="outline" className={markets.corners.firstHalfOver3_5 ? "border-sky-500/30 text-sky-400" : "text-muted-foreground"}>
        1H C3.5 {markets.corners.firstHalfOver3_5 ? "✓" : "✗"}
      </Badge>
    </>
  );
}

function ResultSummary({ prediction }: { prediction: Prediction }) {
  const actual = prediction.actual_result;
  if (!actual) return null;

  const results = summarizeSettledMarkets(prediction.markets, actual.markets);
  const { known, correct } = settledMarketTally(results);

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Final {actual.raw.finalScore.home}–{actual.raw.finalScore.away}
        </div>
        {known > 0 && (
          <Badge
            variant="outline"
            className={correct / known >= 0.5 ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}
          >
            {correct}/{known} correct
          </Badge>
        )}
      </div>
      <SettledMarketBadges predicted={prediction.markets} actual={actual.markets} />
    </div>
  );
}

export function MatchCard({
  prediction,
  leagueName,
  marketFilter,
}: {
  prediction: Prediction;
  leagueName: string;
  marketFilter: MarketFilter;
}) {
  const kickoff = new Date(prediction.match_date);
  const showFtDraw = marketFilter === "all" || marketFilter === "ftDraw";
  const showHighestHalf = marketFilter === "all" || marketFilter === "highestHalf";
  const showWinEitherHalf = marketFilter === "all" || marketFilter === "winEitherHalf";
  const showDrawOrOver = marketFilter === "all" || marketFilter === "drawOrOver";
  const showGoals = marketFilter === "all" || marketFilter === "goals";
  const showCorners = marketFilter === "all" || marketFilter === "corners";
  const showOutcomeSection = showFtDraw || showHighestHalf || showWinEitherHalf;
  const showGoalsSection = showGoals || showDrawOrOver;
  const winEitherHalf = winEitherHalfCode(prediction.markets);

  return (
    <Card className="border-border/60 bg-muted/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="text-xs font-medium text-foreground/80">{leagueName}</div>
        <div className="text-xs font-medium text-foreground/80">
          {kickoff.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
          {" · "}
          {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <CollectionPickerButton predictionId={prediction.id} />
            <Link
              href={`/match/${prediction.id}`}
              className="min-w-0 text-lg font-semibold leading-tight hover:text-primary hover:underline"
            >
              {prediction.home_team}
              <span className="mx-2 text-muted-foreground font-medium">vs</span>
              {prediction.away_team}
            </Link>
          </div>
          <Badge variant="outline" className={cn("shrink-0", confidenceClass(prediction.confidence))}>
            {prediction.confidence}% conf
          </Badge>
        </div>

        <ResultSummary prediction={prediction} />

        {showOutcomeSection && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Outcome</div>
            <div className="flex flex-wrap gap-1.5">
              {showFtDraw && (
                <>
                  <BoolBadge label="FT Draw" value={isFullTimeDraw(prediction.markets)} />
                  <Badge variant="secondary" className="font-medium">
                    1H: {prediction.markets.firstHalfOutcome.label}
                  </Badge>
                </>
              )}
              {showHighestHalf && (
                <Badge variant="secondary" className="font-medium">
                  {prediction.markets.highestScoringHalf.label}
                </Badge>
              )}
              {showWinEitherHalf && (
                <Badge variant="secondary" className="font-medium">
                  Win Either Half:{" "}
                  {winEitherHalf === null
                    ? "–"
                    : winEitherHalf === "1"
                      ? prediction.home_team
                      : prediction.away_team}
                </Badge>
              )}
            </div>
          </div>
        )}

        {showGoalsSection && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Goals</div>
            <div className="flex flex-wrap gap-1.5">
              {showGoals && <GoalsBadges markets={prediction.markets} />}
              {showDrawOrOver && (
                <Badge
                  variant="outline"
                  className={isDrawOrOver2_5(prediction.markets) ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}
                >
                  Draw/O2.5 {isDrawOrOver2_5(prediction.markets) ? "✓" : "✗"}
                </Badge>
              )}
            </div>
          </div>
        )}

        {showCorners && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Corners</div>
            <div className="flex flex-wrap gap-1.5">
              <CornersBadges markets={prediction.markets} />
            </div>
          </div>
        )}

        {prediction.summary && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
              Tactical summary
              <ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 text-sm font-medium text-foreground/90">
              {prediction.summary}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
