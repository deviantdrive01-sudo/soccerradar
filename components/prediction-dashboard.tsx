"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { MarketFilterToggle, type MarketFilter } from "@/components/market-filter";
import { StatsSummary } from "@/components/stats-summary";
import { LeagueSidebar } from "@/components/league-sidebar";
import { ALL_LEAGUES, countryFilterValue, countryFromFilterValue, isCountryFilterValue } from "@/lib/country-filter";
import { TodaysPickSidebar } from "@/components/todays-pick-sidebar";
import { AdSlot } from "@/components/ad-slot";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateKey, dateLabel, todayKey } from "@/lib/date-key";
import { QUICK_FILTER_OPTIONS } from "@/lib/quick-filter";
import { CollectionPickerButton } from "@/components/collection-picker-button";
import { BookingAddButton } from "@/components/booking-add-button";
import { cn } from "cn";
import type { League, Prediction } from "@/lib/supabase/types";

const ALL_DATES = "all";
type ViewMode = "cards" | "table";
const CARD_AD_INTERVAL = 20; // roughly every 6-7 grid rows on the 3-column desktop layout
const MAX_CARD_ADS = 2; // cap total in-feed ads regardless of how long the list gets

/**
 * With full history now kept in the dataset (not just a recent window), the
 * default tab should open on today's — or the next upcoming — matches rather
 * than blindly picking the earliest day, which would otherwise be the oldest
 * day of the whole archive.
 */
function defaultActiveDate(availableDates: { key: string }[]): string {
  if (availableDates.length === 0) return ALL_DATES;
  const today = todayKey();
  const todayOrLater = availableDates.find((d) => d.key >= today);
  return todayOrLater?.key ?? availableDates[availableDates.length - 1].key;
}

/** Lets a favorited-country/league link (e.g. from /account/favorites) land on the filtered view. */
function subscribeUrlLeague() {
  return () => {};
}

function getUrlLeagueSnapshot(): string | null {
  return new URLSearchParams(window.location.search).get("league");
}

function getUrlLeagueServerSnapshot(): string | null {
  return null;
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

  const urlLeague = useSyncExternalStore(subscribeUrlLeague, getUrlLeagueSnapshot, getUrlLeagueServerSnapshot);
  const [activeLeagueOverride, setActiveLeagueOverride] = useState<string | null>(null);
  const activeLeague = activeLeagueOverride ?? urlLeague ?? ALL_LEAGUES;
  const [activeDate, setActiveDate] = useState<string>(() => defaultActiveDate(availableDates));
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  // Table is the default everywhere now; once someone picks a view
  // explicitly, keep it regardless of screen size.
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const viewMode = viewModeOverride ?? "table";

  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l])), [leagues]);

  const dateFilteredPredictions = useMemo(
    () => sortedPredictions.filter((p) => activeDate === ALL_DATES || dateKey(p.match_date) === activeDate),
    [sortedPredictions, activeDate],
  );

  const leagueCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of dateFilteredPredictions) {
      counts.set(p.league_id, (counts.get(p.league_id) ?? 0) + 1);
    }
    return counts;
  }, [dateFilteredPredictions]);

  const leagueCountryGroups = useMemo(() => {
    const byCountry = new Map<string, League[]>();
    for (const league of leagues) {
      const existing = byCountry.get(league.country);
      if (existing) existing.push(league);
      else byCountry.set(league.country, [league]);
    }
    return Array.from(byCountry, ([country, countryLeagues]) => ({
      country,
      leagues: [...countryLeagues].sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.country.localeCompare(b.country));
  }, [leagues]);

  const visiblePredictions = useMemo(() => {
    if (activeLeague === ALL_LEAGUES) return dateFilteredPredictions;
    if (isCountryFilterValue(activeLeague)) {
      const country = countryFromFilterValue(activeLeague);
      return dateFilteredPredictions.filter((p) => leagueById.get(p.league_id)?.country === country);
    }
    return dateFilteredPredictions.filter((p) => p.league_id === Number(activeLeague));
  }, [dateFilteredPredictions, activeLeague, leagueById]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 space-y-4">
        <TodaysPickSidebar />
        <LeagueSidebar
          leagues={leagues}
          counts={leagueCounts}
          totalCount={dateFilteredPredictions.length}
          activeLeague={activeLeague}
          onChange={setActiveLeagueOverride}
          footer={
            <AdSlot
              slotId="7984118524"
              className="mt-2 border-x-0 border-b-0 rounded-b-none rounded-t-none border-t"
            />
          }
        />
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:mx-0 lg:rounded-lg lg:border">
          <div className="lg:hidden">
            <Select value={activeLeague} onValueChange={setActiveLeagueOverride}>
              <SelectTrigger size="sm" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LEAGUES}>All Leagues</SelectItem>
                {leagueCountryGroups.map(({ country, leagues: countryLeagues }) => (
                  <SelectGroup key={country}>
                    <SelectLabel>{country}</SelectLabel>
                    <SelectItem value={countryFilterValue(country)}>All of {country}</SelectItem>
                    {countryLeagues.map((league) => (
                      <SelectItem key={league.id} value={String(league.id)}>
                        {league.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="lg:hidden">
            <ScrollArea className="max-w-[calc(100vw-2rem)]">
              <div className="flex items-center gap-1.5 pb-1">
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">Todays Pick:</span>
                {QUICK_FILTER_OPTIONS.map((option) => (
                  <Link
                    key={option.value}
                    href={`/top-picks/${option.slug}`}
                    className="shrink-0 whitespace-nowrap rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium hover:bg-muted"
                  >
                    {option.collectionTitle}
                  </Link>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {availableDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
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

            <MarketFilterToggle value={marketFilter} onChange={setMarketFilter} />
          </div>
        </div>

        <AdSlot
          orientation="horizontal"
          className="lg:hidden"
          dismissible
          autoHideMs={60_000}
          maxViewsPerSession={3}
        />

        <StatsSummary predictions={visiblePredictions} />

        {visiblePredictions.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No predictions match this search/selection yet.
          </div>
        ) : viewMode === "table" ? (
          <PredictionsTable
            predictions={visiblePredictions}
            leagueById={leagueById}
            marketFilter={marketFilter}
            rowAction={(prediction) => (
              <div className="flex items-center justify-center gap-1">
                <CollectionPickerButton predictionId={prediction.id} />
                <BookingAddButton predictionId={prediction.id} markets={prediction.markets} />
              </div>
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePredictions.map((prediction, index) => (
              <Fragment key={prediction.id}>
                <MatchCard
                  prediction={prediction}
                  leagueName={leagueById.get(prediction.league_id)?.name ?? ""}
                  marketFilter={marketFilter}
                  bookingButton={<BookingAddButton predictionId={prediction.id} markets={prediction.markets} />}
                />
                {(index + 1) % CARD_AD_INTERVAL === 0 &&
                  index !== visiblePredictions.length - 1 &&
                  (index + 1) / CARD_AD_INTERVAL <= MAX_CARD_ADS && (
                    <AdSlot orientation="horizontal" dismissible className="h-full" />
                  )}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
