"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { StatsSummary } from "@/components/stats-summary";
import { ShareButtons } from "@/components/share-buttons";
import { CollectionPickerButton } from "@/components/collection-picker-button";
import { BookingPickButton } from "@/components/booking-pick-button";
import { AdSlot } from "@/components/ad-slot";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { cn } from "cn";
import type { MarketFilter } from "@/components/market-filter";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

type ViewMode = "cards" | "table";
const CARD_AD_INTERVAL = 6; // these collections run shorter than the full dashboard list
const MAX_CARD_ADS = 1;

export function TopPicksView({
  predictions,
  leagueById,
  marketFilter,
  marketKey,
  shareUrl,
  shareTitle,
}: {
  predictions: Prediction[];
  leagueById: Map<number, { name: string }>;
  marketFilter: MarketFilter;
  /** The exact market this collection represents — lets a booking pick be added with no extra selection step. */
  marketKey: MarketKey;
  shareUrl: string;
  shareTitle: string;
}) {
  const isDesktop = useIsDesktop();
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const viewMode = viewModeOverride ?? (isDesktop ? "table" : "cards");

  const toolbar = (
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
  );

  if (predictions.length === 0) {
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="py-16 text-center text-sm text-muted-foreground">No matches for this pick today.</div>
      </div>
    );
  }

  if (viewMode === "table") {
    return (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {toolbar}
          <PredictionsTable
            predictions={predictions}
            leagueById={leagueById}
            marketFilter={marketFilter}
            showInFeedAds={false}
            rowAction={(prediction) => (
              <div className="flex items-center justify-center gap-1">
                <CollectionPickerButton predictionId={prediction.id} />
                <BookingPickButton predictionId={prediction.id} marketKey={marketKey} />
              </div>
            )}
          />
        </div>
        <aside className="hidden lg:block lg:w-64 lg:shrink-0">
          <div className="sticky top-4">
            <AdSlot orientation="vertical" />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {predictions.map((prediction, index) => (
          <Fragment key={prediction.id}>
            <MatchCard
              prediction={prediction}
              leagueName={leagueById.get(prediction.league_id)?.name ?? ""}
              marketFilter={marketFilter}
              bookingButton={<BookingPickButton predictionId={prediction.id} marketKey={marketKey} />}
            />
            {(index + 1) % CARD_AD_INTERVAL === 0 &&
              index !== predictions.length - 1 &&
              (index + 1) / CARD_AD_INTERVAL <= MAX_CARD_ADS && (
                <AdSlot orientation="horizontal" dismissible className="h-full" />
              )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
