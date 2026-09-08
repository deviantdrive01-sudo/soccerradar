import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isDrawOrOver2_5, settledMarketTally, summarizeSettledMarkets, winEitherHalfCode } from "@/lib/hydrate";
import { SettledMarketBadges } from "@/components/settled-market-badges";
import { CollectionPickerButton } from "@/components/collection-picker-button";
import { isPredicted } from "@/lib/supabase/types";
import type { Prediction } from "@/lib/supabase/types";
import type { MarketFilter } from "@/components/market-filter";
import { ChevronDown } from "lucide-react";

// Compact, single-density badge — smaller than the default Badge so a full
// set of predictions can sit in one or two flex-wrap lines instead of three
// separate labeled sections.
const PICK = "px-1.5 py-0 text-[11px] h-4.5";

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-primary/15 text-primary border-primary/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function PickBadge({ label, value, tone = "primary" }: { label: string; value: boolean | null; tone?: "primary" | "sky" }) {
  const activeClass = tone === "sky" ? "border-sky-500/30 text-sky-400" : "border-primary/30 text-primary";
  return (
    <Badge variant="outline" className={cn(PICK, value ? activeClass : "text-muted-foreground")}>
      {label} {value === null ? "–" : value ? "✓" : "✗"}
    </Badge>
  );
}

function ResultSummary({ prediction }: { prediction: Prediction }) {
  const actual = prediction.actual_result;
  // A match can in rare cases settle before it was ever predicted (crawl
  // found the fixture, kickoff passed before generate-predictions got to
  // it) — nothing to grade in that case.
  if (!actual || !prediction.markets) return null;

  const results = summarizeSettledMarkets(prediction.markets, actual.markets);
  const { known, correct } = settledMarketTally(results);

  return (
    <Collapsible className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left transition-colors hover:text-foreground">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            Final {actual.raw.finalScore.home}–{actual.raw.finalScore.away}
          </span>
          {known > 0 && (
            <Badge
              variant="outline"
              className={correct / known >= 0.5 ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}
            >
              {correct}/{known} correct
            </Badge>
          )}
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <SettledMarketBadges predicted={prediction.markets} actual={actual.markets} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MatchCard({
  prediction,
  leagueName,
  marketFilter,
  bookingButton,
}: {
  prediction: Prediction;
  leagueName: string;
  marketFilter: MarketFilter;
  /** Optional — callers decide which booking control fits (fixed-market vs pick-a-market), placed beside the collection button. */
  bookingButton?: React.ReactNode;
}) {
  const kickoff = new Date(prediction.match_date);
  const kickoffLabel = `${kickoff.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · ${kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;

  if (!isPredicted(prediction)) {
    return (
      <Card size="sm" className="border-border/60 bg-muted/60">
        <CardContent className="space-y-1.5 px-3 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <CollectionPickerButton predictionId={prediction.id} />
              <Link
                href={`/match/${prediction.id}`}
                className="min-w-0 text-sm font-semibold leading-tight hover:text-primary hover:underline"
              >
                {prediction.home_team}
                <span className="mx-1.5 text-muted-foreground font-medium">vs</span>
                {prediction.away_team}
              </Link>
            </div>
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              Pending
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {leagueName} · {kickoffLabel}
          </div>
          <p className="text-xs text-muted-foreground">Prediction coming soon — check back shortly.</p>
        </CardContent>
      </Card>
    );
  }

  const showFtDraw = marketFilter === "all" || marketFilter === "ftDraw";
  const showHighestHalf = marketFilter === "all" || marketFilter === "highestHalf";
  const showWinEitherHalf = marketFilter === "all" || marketFilter === "winEitherHalf";
  const showDrawOrOver = marketFilter === "all" || marketFilter === "drawOrOver";
  const showGoals = marketFilter === "all" || marketFilter === "goals";
  const showCorners = marketFilter === "all" || marketFilter === "corners";
  const markets = prediction.markets;
  const winEitherHalf = winEitherHalfCode(markets);

  return (
    <Card size="sm" className="border-border/60 bg-muted/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="space-y-1.5 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <CollectionPickerButton predictionId={prediction.id} />
            {bookingButton}
            <Link
              href={`/match/${prediction.id}`}
              className="min-w-0 text-sm font-semibold leading-tight hover:text-primary hover:underline"
            >
              {prediction.home_team}
              <span className="mx-1.5 text-muted-foreground font-medium">vs</span>
              {prediction.away_team}
            </Link>
          </div>
          <Badge variant="outline" className={cn("shrink-0", confidenceClass(prediction.confidence))}>
            {prediction.confidence}%
          </Badge>
        </div>

        <div className="text-[11px] text-muted-foreground">
          {leagueName} · {kickoffLabel}
        </div>

        <ResultSummary prediction={prediction} />

        {/* Once settled, ResultSummary/SettledMarketBadges above already shows
            every market's predicted value plus whether it landed — showing
            this same set of predictions again below would be pure duplication. */}
        {!prediction.actual_result && (
          <div className="flex flex-wrap gap-1">
            {showFtDraw && (
              <>
                <Badge variant="secondary" className={PICK}>
                  FT {markets.outcome.code}
                </Badge>
                <Badge variant="secondary" className={PICK}>
                  1H {markets.firstHalfOutcome.code}
                </Badge>
              </>
            )}
            {showHighestHalf && (
              <Badge variant="secondary" className={PICK}>
                {markets.highestScoringHalf.code}
              </Badge>
            )}
            {showWinEitherHalf && (
              <Badge variant="secondary" className={PICK}>
                WEH {winEitherHalf === null ? "–" : winEitherHalf === "1" ? "Home" : "Away"}
              </Badge>
            )}
            {showGoals && (
              <>
                <PickBadge label="O1.5" value={markets.goals.over1_5} />
                <PickBadge label="O2.5" value={markets.goals.over2_5} />
              </>
            )}
            {showDrawOrOver && <PickBadge label="D/O2.5" value={isDrawOrOver2_5(markets)} />}
            {showCorners && (
              <>
                <PickBadge label="C7.5" value={markets.corners.over7_5} tone="sky" />
                <PickBadge label="1HC3.5" value={markets.corners.firstHalfOver3_5} tone="sky" />
              </>
            )}
          </div>
        )}

        {prediction.summary && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
              Tactical summary
              <ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pt-2">
              <p className="text-xs font-medium text-foreground/90">{prediction.summary}</p>
              <Link href={`/match/${prediction.id}`} className="text-xs font-medium text-primary hover:underline">
                See match details &amp; head-to-head →
              </Link>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
