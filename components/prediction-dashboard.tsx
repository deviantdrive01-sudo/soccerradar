"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { SearchDropdown } from "@/components/search-dropdown";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { MarketFilterToggle, type MarketFilter } from "@/components/market-filter";
import { StatsSummary } from "@/components/stats-summary";
import { LeagueSidebar, ALL_LEAGUES } from "@/components/league-sidebar";
import { AdSlot } from "@/components/ad-slot";
import { dateKey, dateLabel } from "@/lib/date-key";
import { cn } from "cn";
import type { League, Prediction } from "@/lib/supabase/types";

const ALL_DATES = "all";
type ViewMode = "cards" | "table";
const CARD_AD_INTERVAL = 9; // roughly every 3 grid rows on the 3-column desktop layout

/** Impure by nature (reads the clock) — kept out of the component body so it isn't flagged as a render-purity violation. */
function todayKey(): string {
  return dateKey(new Date().toISOString());
}

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

const DESKTOP_QUERY = "(min-width: 1024px)"; // matches Tailwind's `lg` breakpoint used elsewhere in this component

function subscribeIsDesktop(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getIsDesktopServerSnapshot(): boolean {
  return false;
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
  const [activeDate, setActiveDate] = useState<string>(() => defaultActiveDate(availableDates));
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  // Table's dense multi-column layout needs room a phone doesn't have — default
  // to Cards (no horizontal scrolling) on mobile and Table on desktop, but once
  // someone picks a view explicitly, keep it regardless of screen size.
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const isDesktop = useSyncExternalStore(subscribeIsDesktop, getIsDesktopSnapshot, getIsDesktopServerSnapshot);
  const viewMode = viewModeOverride ?? (isDesktop ? "table" : "cards");
  const [searchQuery, setSearchQuery] = useState("");

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

  const visiblePredictions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return dateFilteredPredictions.filter((p) => {
      if (activeLeague !== ALL_LEAGUES && p.league_id !== Number(activeLeague)) return false;
      if (query) {
        const leagueName = leagueById.get(p.league_id)?.name ?? "";
        const haystack = `${p.home_team} ${p.away_team} ${leagueName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [dateFilteredPredictions, activeLeague, searchQuery, leagueById]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">
        <LeagueSidebar
          leagues={leagues}
          counts={leagueCounts}
          totalCount={dateFilteredPredictions.length}
          activeLeague={activeLeague}
          onChange={setActiveLeague}
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
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams or leagues…"
              className="h-8 w-full rounded-md border border-border/60 bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
            <SearchDropdown query={searchQuery} />
          </div>

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
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePredictions.map((prediction, index) => (
              <Fragment key={prediction.id}>
                <MatchCard
                  prediction={prediction}
                  leagueName={leagueById.get(prediction.league_id)?.name ?? ""}
                  marketFilter={marketFilter}
                />
                {(index + 1) % CARD_AD_INTERVAL === 0 && index !== visiblePredictions.length - 1 && (
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
