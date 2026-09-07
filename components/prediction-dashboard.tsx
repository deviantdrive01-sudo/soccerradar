"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { MarketFilterToggle, type MarketFilter } from "@/components/market-filter";
import { StatsSummary } from "@/components/stats-summary";
import { LeagueSidebar } from "@/components/league-sidebar";
import { ALL_LEAGUES, countryFromFilterValue, isCountryFilterValue } from "@/lib/country-filter";
import { TodaysPickSidebar } from "@/components/todays-pick-sidebar";
import { AdSlot } from "@/components/ad-slot";
import { dateKey, dateLabel, todayKey } from "@/lib/date-key";
import { QUICK_FILTER_OPTIONS } from "@/lib/quick-filter";
import { CollectionPickerButton } from "@/components/collection-picker-button";
import { BookingAddButton } from "@/components/booking-add-button";
import { useAccount } from "@/components/account-provider";
import { useIsMobile } from "@/lib/use-is-mobile";
import { ListFilter, X } from "lucide-react";
import { cn } from "cn";
import { isPredicted } from "@/lib/supabase/types";
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

  // Filter/view state lives in the URL (not local useState) so browser back
  // navigation from a match/booking/collection page restores exactly what
  // was selected, instead of resetting to defaults on remount.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeLeague = searchParams.get("league") ?? ALL_LEAGUES;
  const activeDate = searchParams.get("date") ?? defaultActiveDate(availableDates);
  const marketFilter = (searchParams.get("market") as MarketFilter | null) ?? "all";
  // Cards by default on mobile (the table needs horizontal scrolling there),
  // table by default on larger screens; once someone picks a view
  // explicitly via the toggle, that choice sticks regardless of screen size.
  const isMobile = useIsMobile();
  const viewMode = (searchParams.get("view") as ViewMode | null) ?? (isMobile ? "cards" : "table");

  const updateParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // Shared by the compact sticky-bar button and the floating FAB (mobile
  // only) — both just open this one drawer, which reuses LeagueSidebar as-is
  // so mobile gets the same favorite-toggle buttons desktop already has.
  const [leagueDrawerOpen, setLeagueDrawerOpen] = useState(false);

  const setActiveLeagueOverride = useCallback((v: string) => updateParam("league", v, ALL_LEAGUES), [updateParam]);
  const setActiveDate = useCallback(
    (v: string) => updateParam("date", v, defaultActiveDate(availableDates)),
    [updateParam, availableDates],
  );
  const setMarketFilter = useCallback((v: MarketFilter) => updateParam("market", v, "all"), [updateParam]);
  const setViewModeOverride = useCallback((v: ViewMode) => updateParam("view", v, "table"), [updateParam]);

  const { favoriteLeagueIds } = useAccount();

  // Favorite leagues first (then alphabetical) — both the table's grouping
  // and the card grouping below just iterate this Map, so this one ordering
  // drives both views consistently. Matches the same favDiff pattern used
  // in LeagueSidebar.
  const leagueById = useMemo(() => {
    const sorted = [...leagues].sort((a, b) => {
      const favDiff = Number(favoriteLeagueIds.has(b.id)) - Number(favoriteLeagueIds.has(a.id));
      return favDiff !== 0 ? favDiff : a.name.localeCompare(b.name);
    });
    return new Map(sorted.map((l) => [l.id, l]));
  }, [leagues, favoriteLeagueIds]);

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

  const visiblePredictions = useMemo(() => {
    if (activeLeague === ALL_LEAGUES) return dateFilteredPredictions;
    if (isCountryFilterValue(activeLeague)) {
      const country = countryFromFilterValue(activeLeague);
      return dateFilteredPredictions.filter((p) => leagueById.get(p.league_id)?.country === country);
    }
    return dateFilteredPredictions.filter((p) => p.league_id === Number(activeLeague));
  }, [dateFilteredPredictions, activeLeague, leagueById]);

  const activeLeagueLabel = useMemo(() => {
    if (activeLeague === ALL_LEAGUES) return "All Leagues";
    if (isCountryFilterValue(activeLeague)) return countryFromFilterValue(activeLeague);
    return leagueById.get(Number(activeLeague))?.name ?? "All Leagues";
  }, [activeLeague, leagueById]);

  // Table view groups by league internally (it just iterates leagueById, so
  // it already picks up the favorites-first order above) — Cards view needs
  // the same grouping done explicitly here.
  const globalIndexById = useMemo(() => new Map(visiblePredictions.map((p, i) => [p.id, i])), [visiblePredictions]);
  const visiblePredictionsByLeague = useMemo(() => {
    const byLeague = new Map<number, Prediction[]>();
    for (const p of visiblePredictions) {
      const existing = byLeague.get(p.league_id);
      if (existing) existing.push(p);
      else byLeague.set(p.league_id, [p]);
    }
    const groups: { leagueId: number; leagueName: string; predictions: Prediction[] }[] = [];
    for (const [leagueId, league] of leagueById) {
      const preds = byLeague.get(leagueId);
      if (preds && preds.length > 0) groups.push({ leagueId, leagueName: league.name, predictions: preds });
    }
    return groups;
  }, [visiblePredictions, leagueById]);

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
          <div className="hidden sm:block lg:hidden" data-tour="todays-pick">
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

          <div className="flex flex-wrap items-center gap-2" data-tour="view-toggle">
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

        <div data-tour="match-list">
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
                  {isPredicted(prediction) && (
                    <BookingAddButton predictionId={prediction.id} markets={prediction.markets} />
                  )}
                </div>
              )}
            />
          ) : (
            <div className="space-y-6">
              {visiblePredictionsByLeague.map((group) => (
                <div key={group.leagueId} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.leagueName}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.predictions.map((prediction) => {
                      const index = globalIndexById.get(prediction.id) ?? 0;
                      return (
                        <Fragment key={prediction.id}>
                          <MatchCard
                            prediction={prediction}
                            leagueName={group.leagueName}
                            marketFilter={marketFilter}
                            bookingButton={
                              isPredicted(prediction) ? (
                                <BookingAddButton predictionId={prediction.id} markets={prediction.markets} />
                              ) : undefined
                            }
                          />
                          {(index + 1) % CARD_AD_INTERVAL === 0 &&
                            index !== visiblePredictions.length - 1 &&
                            (index + 1) / CARD_AD_INTERVAL <= MAX_CARD_ADS && (
                              <AdSlot orientation="horizontal" dismissible className="h-full" />
                            )}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick access to the league picker without scrolling back to the
          sticky top bar — thumb-reachable, phone/tablet only. */}
      <button
        type="button"
        data-tour="league-sidebar"
        onClick={() => setLeagueDrawerOpen(true)}
        className="fixed bottom-20 right-4 z-20 flex max-w-[65vw] items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 lg:hidden"
      >
        <ListFilter className="size-4 shrink-0" />
        <span className="truncate">{activeLeagueLabel}</span>
      </button>

      {leagueDrawerOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setLeagueDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-background p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-sm font-semibold">Leagues</span>
              <button
                type="button"
                onClick={() => setLeagueDrawerOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <LeagueSidebar
              leagues={leagues}
              counts={leagueCounts}
              totalCount={dateFilteredPredictions.length}
              activeLeague={activeLeague}
              onChange={(value) => {
                setActiveLeagueOverride(value);
                setLeagueDrawerOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
