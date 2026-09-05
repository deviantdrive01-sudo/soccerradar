"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { MarketFilterSelect, type MarketFilter } from "@/components/market-filter";
import { cn } from "cn";
import type { League, Prediction } from "@/lib/supabase/types";

const ALL_LEAGUES = "all";
const ALL_DATES = "all";
type ViewMode = "cards" | "table";

/** Local-calendar-day key (not UTC) so "today"/"tomorrow" match what the viewer sees on their clock. */
function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function PredictionDashboard({
  leagues,
  predictions,
}: {
  leagues: League[];
  predictions: Prediction[];
}) {
  const sortedPredictions = useMemo(
    () => [...predictions].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()),
    [predictions],
  );

  const availableDates = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of sortedPredictions) {
      const key = dateKey(p.match_date);
      if (!seen.has(key)) seen.set(key, dateLabel(p.match_date));
    }
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [sortedPredictions]);

  const [activeLeague, setActiveLeague] = useState<string>(ALL_LEAGUES);
  const [activeDate, setActiveDate] = useState<string>(() => availableDates[0]?.key ?? ALL_DATES);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l])), [leagues]);

  const visiblePredictions = useMemo(() => {
    return sortedPredictions.filter(
      (p) =>
        (activeLeague === ALL_LEAGUES || p.league_id === Number(activeLeague)) &&
        (activeDate === ALL_DATES || dateKey(p.match_date) === activeDate),
    );
  }, [sortedPredictions, activeLeague, activeDate]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Tabs value={activeLeague} onValueChange={setActiveLeague}>
          <ScrollArea className="max-w-[calc(100vw-2rem)]">
            <TabsList>
              <TabsTrigger value={ALL_LEAGUES}>All Leagues</TabsTrigger>
              {leagues.map((league) => (
                <TabsTrigger key={league.id} value={String(league.id)}>
                  {league.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {availableDates.length > 0 && (
            <Tabs value={activeDate} onValueChange={setActiveDate}>
              <ScrollArea className="max-w-[calc(100vw-2rem)]">
                <TabsList>
                  {availableDates.length > 1 && <TabsTrigger value={ALL_DATES}>All Dates</TabsTrigger>}
                  {availableDates.map((date) => (
                    <TabsTrigger key={date.key} value={date.key}>
                      {date.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border/60 p-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setViewMode("cards")}
                className={cn("h-7 px-3", viewMode === "cards" && "bg-muted text-foreground")}
              >
                Cards
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setViewMode("table")}
                className={cn("h-7 px-3", viewMode === "table" && "bg-muted text-foreground")}
              >
                Table
              </Button>
            </div>

            <MarketFilterSelect value={marketFilter} onChange={setMarketFilter} />
          </div>
        </div>
      </div>

      {visiblePredictions.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No predictions available for this selection yet.
        </div>
      ) : viewMode === "table" ? (
        <PredictionsTable
          predictions={visiblePredictions}
          leagueById={leagueById}
          marketFilter={marketFilter}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePredictions.map((prediction) => (
            <MatchCard
              key={prediction.id}
              prediction={prediction}
              leagueName={leagueById.get(prediction.league_id)?.name ?? ""}
              marketFilter={marketFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
