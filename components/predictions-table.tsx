import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";
import { isDrawOrOver2_5 } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";
import type { MarketFilter } from "@/components/market-filter";

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

const OUTCOME_BADGE_CLASS: Record<string, string> = {
  "1": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  X: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  "2": "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-emerald-400" : "text-muted-foreground"}>
      {value ? "✓" : "✗"}
    </span>
  );
}

export function PredictionsTable({
  predictions,
  leagueById,
  marketFilter,
}: {
  predictions: Prediction[];
  leagueById: Map<number, { name: string }>;
  marketFilter: MarketFilter;
}) {
  const showWinMarkets = marketFilter === "all" || marketFilter === "outcome";
  const showGoals = marketFilter === "all" || marketFilter === "goals";
  const showCorners = marketFilter === "all" || marketFilter === "corners";

  const columnCount =
    2 + // Match, Kickoff
    (showWinMarkets ? 3 : 0) +
    (showGoals ? 3 : 0) +
    (showCorners ? 3 : 0) +
    1; // Confidence

  const groups: { leagueId: number; leagueName: string; rows: Prediction[] }[] = [];
  for (const [leagueId, league] of leagueById) {
    const rows = predictions.filter((p) => p.league_id === leagueId);
    if (rows.length > 0) groups.push({ leagueId, leagueName: league.name, rows });
  }

  return (
    <div className="rounded-md border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Match</TableHead>
            <TableHead>Kickoff</TableHead>
            {showWinMarkets && <TableHead>Outcome</TableHead>}
            {showWinMarkets && <TableHead>1H</TableHead>}
            {showWinMarkets && <TableHead>Highest Half</TableHead>}
            {showGoals && <TableHead className="text-center">O1.5</TableHead>}
            {showGoals && <TableHead className="text-center">O2.5</TableHead>}
            {showGoals && <TableHead className="text-center">Draw/O2.5</TableHead>}
            {showCorners && <TableHead className="text-center">C7.5</TableHead>}
            {showCorners && <TableHead className="text-center">C8.5</TableHead>}
            {showCorners && <TableHead className="text-center">1H C3.5</TableHead>}
            <TableHead>Confidence</TableHead>
          </TableRow>
        </TableHeader>
        {groups.map((group) => (
          <TableBody key={group.leagueId}>
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columnCount}
                className="bg-muted/40 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground"
              >
                {group.leagueName}
              </TableCell>
            </TableRow>
            {group.rows.map((prediction) => {
              const kickoff = new Date(prediction.match_date);
              return (
                <TableRow key={prediction.id}>
                  <TableCell className="font-medium">
                    {prediction.home_team}
                    <span className="mx-1.5 text-muted-foreground font-normal">vs</span>
                    {prediction.away_team}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {kickoff.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" · "}
                    {kickoff.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  {showWinMarkets && (
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", OUTCOME_BADGE_CLASS[prediction.markets.outcome.code])}
                      >
                        {prediction.markets.outcome.label}
                      </Badge>
                    </TableCell>
                  )}
                  {showWinMarkets && (
                    <TableCell className="text-muted-foreground">
                      {prediction.markets.firstHalfOutcome.label}
                    </TableCell>
                  )}
                  {showWinMarkets && (
                    <TableCell className="text-muted-foreground">
                      {prediction.markets.highestScoringHalf.label}
                    </TableCell>
                  )}
                  {showGoals && (
                    <TableCell className="text-center">
                      <YesNo value={prediction.markets.goals.over1_5} />
                    </TableCell>
                  )}
                  {showGoals && (
                    <TableCell className="text-center">
                      <YesNo value={prediction.markets.goals.over2_5} />
                    </TableCell>
                  )}
                  {showGoals && (
                    <TableCell className="text-center">
                      <YesNo value={isDrawOrOver2_5(prediction.markets)} />
                    </TableCell>
                  )}
                  {showCorners && (
                    <TableCell className="text-center">
                      <YesNo value={prediction.markets.corners.over7_5} />
                    </TableCell>
                  )}
                  {showCorners && (
                    <TableCell className="text-center">
                      <YesNo value={prediction.markets.corners.over8_5} />
                    </TableCell>
                  )}
                  {showCorners && (
                    <TableCell className="text-center">
                      <YesNo value={prediction.markets.corners.firstHalfOver3_5} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className={cn("shrink-0", confidenceClass(prediction.confidence))}>
                      {prediction.confidence}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        ))}
      </Table>
    </div>
  );
}
