"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { StatsSummary } from "@/components/stats-summary";
import { ShareButtons } from "@/components/share-buttons";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { cn } from "cn";
import type { MarketFilter } from "@/components/market-filter";
import type { Prediction } from "@/lib/supabase/types";

type ViewMode = "cards" | "table";

export function TopPicksView({
  predictions,
  leagueById,
  marketFilter,
  shareUrl,
  shareTitle,
}: {
  predictions: Prediction[];
  leagueById: Map<number, { name: string }>;
  marketFilter: MarketFilter;
  shareUrl: string;
  shareTitle: string;
}) {
  const isDesktop = useIsDesktop();
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const viewMode = viewModeOverride ?? (isDesktop ? "table" : "cards");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatsSummary predictions={predictions} />
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-border/60 p-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setViewModeOverride("cards")}
              className={cn("h-7 px-3", viewMode === "cards" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
            >
              Cards
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setViewModeOverride("table")}
              className={cn("h-7 px-3", viewMode === "table" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
            >
              Table
            </Button>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1">
            <ShareButtons url={shareUrl} title={shareTitle} />
          </div>
        </div>
      </div>

      {predictions.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No matches for this pick today.</div>
      ) : viewMode === "table" ? (
        <PredictionsTable predictions={predictions} leagueById={leagueById} marketFilter={marketFilter} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {predictions.map((prediction) => (
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
