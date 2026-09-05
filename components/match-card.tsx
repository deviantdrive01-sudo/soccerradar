import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isDrawOrOver2_5 } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";
import type { MarketFilter } from "@/components/market-filter";
import { ChevronDown } from "lucide-react";

const OUTCOME_BADGE_CLASS: Record<string, string> = {
  "1": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  X: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  "2": "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function OutcomeBadge({ code, label }: { code: string; label: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", OUTCOME_BADGE_CLASS[code])}>
      {label}
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
      <Badge variant="outline" className={isDrawOrOver2_5(markets) ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}>
        Draw/O2.5 {isDrawOrOver2_5(markets) ? "✓" : "✗"}
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
  const showWinMarkets = marketFilter === "all" || marketFilter === "outcome";
  const showGoals = marketFilter === "all" || marketFilter === "goals";
  const showCorners = marketFilter === "all" || marketFilter === "corners";

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="text-xs font-medium text-muted-foreground">{leagueName}</div>
        <div className="text-xs text-muted-foreground">
          {kickoff.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          {" · "}
          {kickoff.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold leading-tight">
            {prediction.home_team}
            <span className="mx-2 text-muted-foreground font-normal">vs</span>
            {prediction.away_team}
          </div>
          <Badge variant="outline" className={cn("shrink-0", confidenceClass(prediction.confidence))}>
            {prediction.confidence}% conf
          </Badge>
        </div>

        {showWinMarkets && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Outcome</div>
            <div className="flex flex-wrap gap-1.5">
              <OutcomeBadge code={prediction.markets.outcome.code} label={prediction.markets.outcome.label} />
              <Badge variant="secondary" className="font-normal">
                1H: {prediction.markets.firstHalfOutcome.label}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {prediction.markets.highestScoringHalf.label}
              </Badge>
            </div>
          </div>
        )}

        {showGoals && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Goals</div>
            <div className="flex flex-wrap gap-1.5">
              <GoalsBadges markets={prediction.markets} />
            </div>
          </div>
        )}

        {showCorners && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Corners</div>
            <div className="flex flex-wrap gap-1.5">
              <CornersBadges markets={prediction.markets} />
            </div>
          </div>
        )}

        {prediction.summary && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
              Tactical summary
              <ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 text-sm text-foreground/80">
              {prediction.summary}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
