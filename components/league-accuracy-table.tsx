"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { accuracyPct, type LeagueAccuracy } from "@/lib/accuracy";
import { settledMarketTally, summarizeSettledMarkets } from "@/lib/hydrate";
import { SettledMarketBadges } from "@/components/settled-market-badges";
import type { Prediction } from "@/lib/supabase/types";
import { cn } from "cn";

function pctClass(pct: number, known: number): string {
  if (known === 0) return "border-border/60 text-muted-foreground";
  if (pct >= 60) return "border-emerald-500/30 text-emerald-400";
  if (pct >= 45) return "border-amber-500/30 text-amber-400";
  return "border-red-500/30 text-red-400";
}

function MatchRow({ prediction }: { prediction: Prediction }) {
  const actual = prediction.actual_result;
  if (!actual) return null;

  const results = summarizeSettledMarkets(prediction.markets, actual.markets);
  const { known, correct } = settledMarketTally(results);

  return (
    <div className="space-y-1.5 border-t border-border/40 px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/match/${prediction.id}`} className="text-sm font-medium hover:text-primary hover:underline">
          {prediction.home_team} <span className="font-normal text-muted-foreground">vs</span> {prediction.away_team}
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">
            {actual.raw.finalScore.home}–{actual.raw.finalScore.away}
          </span>
          {known > 0 && (
            <Badge
              variant="outline"
              className={correct / known >= 0.5 ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}
            >
              {correct}/{known}
            </Badge>
          )}
        </div>
      </div>
      <SettledMarketBadges predicted={prediction.markets} actual={actual.markets} />
    </div>
  );
}

export function LeagueAccuracyTable({
  byLeague,
  settledByLeague,
}: {
  byLeague: LeagueAccuracy[];
  settledByLeague: Map<number, Prediction[]>;
}) {
  const [openLeagueId, setOpenLeagueId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-muted-foreground">
            <th className="p-3 font-medium">League</th>
            <th className="p-3 font-medium">Settled</th>
            <th className="p-3 font-medium">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {byLeague.map((league) => {
            const isOpen = openLeagueId === league.leagueId;
            const pct = accuracyPct(league.summary.overallCorrect, league.summary.overallKnown);
            const matches = settledByLeague.get(league.leagueId) ?? [];

            return (
              <Fragment key={league.leagueId}>
                <tr
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                  onClick={() => setOpenLeagueId(isOpen ? null : league.leagueId)}
                >
                  <td className="p-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      {league.leagueName}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{league.summary.totalSettled}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={pctClass(pct, league.summary.overallKnown)}>
                      {pct}%
                    </Badge>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border/60 last:border-0">
                    <td colSpan={3} className="bg-muted/20 p-0">
                      {matches.map((m) => (
                        <MatchRow key={m.id} prediction={m} />
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
