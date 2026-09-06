import Link from "next/link";
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
import { isDrawOrOver2_5, isFullTimeDraw, isMarketCorrect, MARKET_KEYS, winEitherHalfCode } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";
import type { MarketFilter } from "@/components/market-filter";

const CELL = "px-1.5 py-1.5";

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function YesNo({ value }: { value: boolean | null }) {
  return (
    <span className={value ? "text-emerald-400" : "text-muted-foreground"}>
      {value === null ? "–" : value ? "✓" : "✗"}
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
  const showFtDraw = marketFilter === "all" || marketFilter === "ftDraw";
  const showHighestHalf = marketFilter === "all" || marketFilter === "highestHalf";
  const showWinEitherHalf = marketFilter === "all" || marketFilter === "winEitherHalf";
  const showDrawOrOver = marketFilter === "all" || marketFilter === "drawOrOver";
  const showGoals = marketFilter === "all" || marketFilter === "goals";
  const showCorners = marketFilter === "all" || marketFilter === "corners";
  // Most predictions are pre-match — don't waste a column on "–" when nothing in view has settled yet.
  const showResult = predictions.some((p) => p.actual_result !== null);

  const columnCount =
    2 + // Match, Kickoff
    (showResult ? 1 : 0) +
    (showFtDraw ? 2 : 0) +
    (showHighestHalf ? 1 : 0) +
    (showWinEitherHalf ? 1 : 0) +
    (showDrawOrOver ? 1 : 0) +
    (showGoals ? 2 : 0) +
    (showCorners ? 3 : 0) +
    1; // Confidence

  const groups: { leagueId: number; leagueName: string; rows: Prediction[] }[] = [];
  for (const [leagueId, league] of leagueById) {
    const rows = predictions.filter((p) => p.league_id === leagueId);
    if (rows.length > 0) groups.push({ leagueId, leagueName: league.name, rows });
  }

  return (
    <div className="rounded-md border border-border/60">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className={CELL}>Match</TableHead>
            <TableHead className={cn(CELL, "text-center")}>Kickoff</TableHead>
            {showResult && <TableHead className={CELL}>Result</TableHead>}
            {showFtDraw && <TableHead className={cn(CELL, "text-center")}>FT Draw</TableHead>}
            {showFtDraw && <TableHead className={cn(CELL, "text-center")}>1H</TableHead>}
            {showHighestHalf && <TableHead className={CELL}>Top Half</TableHead>}
            {showWinEitherHalf && <TableHead className={cn(CELL, "text-center")}>Win E/H</TableHead>}
            {showDrawOrOver && <TableHead className={cn(CELL, "text-center")}>Draw/O2.5</TableHead>}
            {showGoals && <TableHead className={cn(CELL, "text-center")}>O1.5</TableHead>}
            {showGoals && <TableHead className={cn(CELL, "text-center")}>O2.5</TableHead>}
            {showCorners && <TableHead className={cn(CELL, "text-center")}>C7.5</TableHead>}
            {showCorners && <TableHead className={cn(CELL, "text-center")}>C8.5</TableHead>}
            {showCorners && <TableHead className={cn(CELL, "text-center")}>1H C3.5</TableHead>}
            <TableHead className={cn(CELL, "text-center")}>Conf</TableHead>
          </TableRow>
        </TableHeader>
        {groups.map((group) => (
          <TableBody key={group.leagueId}>
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columnCount}
                className="bg-muted/40 px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground"
              >
                {group.leagueName}
              </TableCell>
            </TableRow>
            {group.rows.map((prediction) => {
              const kickoff = new Date(prediction.match_date);
              const winEitherHalf = winEitherHalfCode(prediction.markets);
              return (
                <TableRow key={prediction.id}>
                  <TableCell className={cn(CELL, "font-medium")}>
                    <Link href={`/match/${prediction.id}`} className="hover:text-primary hover:underline">
                      {prediction.home_team}
                      <span className="mx-1 text-muted-foreground font-normal">vs</span>
                      {prediction.away_team}
                    </Link>
                  </TableCell>
                  <TableCell className={cn(CELL, "text-center text-muted-foreground")}>
                    {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                  </TableCell>
                  {showResult && (
                    <TableCell className={CELL}>
                      {prediction.actual_result ? (
                        (() => {
                          const actual = prediction.actual_result;
                          const known = MARKET_KEYS.map((key) =>
                            isMarketCorrect(prediction.markets, actual.markets, key),
                          ).filter((v): v is boolean => v !== null);
                          const correctCount = known.filter(Boolean).length;
                          return (
                            <span className="whitespace-nowrap">
                              {actual.raw.finalScore.home}–{actual.raw.finalScore.away}{" "}
                              <span className="text-muted-foreground">
                                ({correctCount}/{known.length})
                              </span>
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  )}
                  {showFtDraw && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={isFullTimeDraw(prediction.markets)} />
                    </TableCell>
                  )}
                  {showFtDraw && (
                    <TableCell className={cn(CELL, "text-center text-muted-foreground")}>
                      {prediction.markets.firstHalfOutcome.code}
                    </TableCell>
                  )}
                  {showHighestHalf && (
                    <TableCell className={cn(CELL, "whitespace-nowrap text-muted-foreground")}>
                      {prediction.markets.highestScoringHalf.code}
                    </TableCell>
                  )}
                  {showWinEitherHalf && (
                    <TableCell className={cn(CELL, "text-center text-muted-foreground")}>
                      {winEitherHalf ?? "–"}
                    </TableCell>
                  )}
                  {showDrawOrOver && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={isDrawOrOver2_5(prediction.markets)} />
                    </TableCell>
                  )}
                  {showGoals && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={prediction.markets.goals.over1_5} />
                    </TableCell>
                  )}
                  {showGoals && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={prediction.markets.goals.over2_5} />
                    </TableCell>
                  )}
                  {showCorners && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={prediction.markets.corners.over7_5} />
                    </TableCell>
                  )}
                  {showCorners && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={prediction.markets.corners.over8_5} />
                    </TableCell>
                  )}
                  {showCorners && (
                    <TableCell className={cn(CELL, "text-center")}>
                      <YesNo value={prediction.markets.corners.firstHalfOver3_5} />
                    </TableCell>
                  )}
                  <TableCell className={cn(CELL, "text-center")}>
                    <Badge variant="outline" className={cn("shrink-0 px-1.5 py-0 text-[11px]", confidenceClass(prediction.confidence))}>
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
