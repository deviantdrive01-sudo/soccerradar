"use client";

import { useMemo } from "react";
import { cn } from "cn";
import { FavoriteButton } from "@/components/favorite-button";
import { useAccount } from "@/components/account-provider";
import { ALL_LEAGUES, countryFilterValue } from "@/lib/country-filter";
import type { League } from "@/lib/supabase/types";

function CountryRow({
  country,
  count,
  isActive,
  onClick,
}: {
  country: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center transition-colors",
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground/80 hover:bg-muted",
      )}
    >
      <FavoriteButton target={{ type: "country", country }} className="ml-2 shrink-0" data-tour="favorite-button" />
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center justify-between py-2.5 pl-1 pr-3 text-[10px] font-semibold uppercase tracking-wide"
      >
        <span>{country}</span>
        <span className={cn("mr-1", isActive ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{count}</span>
      </button>
    </div>
  );
}

function LeagueRow({
  league,
  count,
  isActive,
  onClick,
}: {
  league: League;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center transition-colors",
        isActive ? "bg-primary font-semibold text-primary-foreground" : "text-foreground/90 hover:bg-muted",
      )}
    >
      <FavoriteButton target={{ type: "league", leagueId: league.id }} className="ml-5 shrink-0" />
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center justify-between py-2 pl-1 pr-3 text-sm">
        <span className="truncate">{league.name}</span>
        <span className={cn("ml-2 shrink-0 text-xs font-medium", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {count}
        </span>
      </button>
    </div>
  );
}

export function LeagueSidebar({
  leagues,
  counts,
  totalCount,
  activeLeague,
  onChange,
  footer,
}: {
  leagues: League[];
  counts: Map<number, number>;
  totalCount: number;
  activeLeague: string;
  onChange: (value: string) => void;
  footer?: React.ReactNode;
}) {
  const { favoriteCountries, favoriteLeagueIds } = useAccount();
  const visibleLeagues = leagues.filter((l) => (counts.get(l.id) ?? 0) > 0);

  const countryGroups = useMemo(() => {
    const byCountry = new Map<string, League[]>();
    for (const league of visibleLeagues) {
      const existing = byCountry.get(league.country);
      if (existing) existing.push(league);
      else byCountry.set(league.country, [league]);
    }
    return Array.from(byCountry, ([country, countryLeagues]) => ({
      country,
      leagues: [...countryLeagues].sort((a, b) => {
        const favDiff = Number(favoriteLeagueIds.has(b.id)) - Number(favoriteLeagueIds.has(a.id));
        return favDiff !== 0 ? favDiff : a.name.localeCompare(b.name);
      }),
    })).sort((a, b) => {
      const favDiff = Number(favoriteCountries.has(b.country)) - Number(favoriteCountries.has(a.country));
      return favDiff !== 0 ? favDiff : a.country.localeCompare(b.country);
    });
  }, [visibleLeagues, favoriteCountries, favoriteLeagueIds]);

  // A dedicated quick-access block so a favorite is reachable in one glance
  // right under "All Leagues" — it still also appears in its normal spot
  // within the country listing below, this is just a shortcut.
  const favoriteCountryRows = useMemo(() => {
    const countByCountry = new Map<string, number>();
    for (const league of visibleLeagues) {
      countByCountry.set(league.country, (countByCountry.get(league.country) ?? 0) + (counts.get(league.id) ?? 0));
    }
    return Array.from(favoriteCountries)
      .filter((country) => countByCountry.has(country))
      .sort((a, b) => a.localeCompare(b))
      .map((country) => ({ country, count: countByCountry.get(country) ?? 0 }));
  }, [visibleLeagues, favoriteCountries, counts]);

  const favoriteLeagueRows = useMemo(
    () =>
      visibleLeagues
        .filter((l) => favoriteLeagueIds.has(l.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visibleLeagues, favoriteLeagueIds],
  );

  const hasFavorites = favoriteCountryRows.length > 0 || favoriteLeagueRows.length > 0;

  return (
    <nav
      data-tour="league-sidebar"
      className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-lg border border-border/60 bg-card/40"
    >
      <button
        type="button"
        onClick={() => onChange(ALL_LEAGUES)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold transition-colors",
          activeLeague === ALL_LEAGUES ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        )}
      >
        <span>All Leagues</span>
        <span
          className={cn(
            "text-xs font-medium",
            activeLeague === ALL_LEAGUES ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {totalCount}
        </span>
      </button>

      {hasFavorites && (
        <div className="border-t border-border/60">
          <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            Favorites
          </div>
          {favoriteCountryRows.map(({ country, count }) => (
            <CountryRow
              key={`fav-country-${country}`}
              country={country}
              count={count}
              isActive={activeLeague === countryFilterValue(country)}
              onClick={() => onChange(countryFilterValue(country))}
            />
          ))}
          {favoriteLeagueRows.map((league) => (
            <LeagueRow
              key={`fav-league-${league.id}`}
              league={league}
              count={counts.get(league.id) ?? 0}
              isActive={activeLeague === String(league.id)}
              onClick={() => onChange(String(league.id))}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border/60">
        {countryGroups.map(({ country, leagues: countryLeagues }) => {
          const countryValue = countryFilterValue(country);
          const countryCount = countryLeagues.reduce((sum, l) => sum + (counts.get(l.id) ?? 0), 0);
          return (
            <div key={country}>
              <CountryRow
                country={country}
                count={countryCount}
                isActive={activeLeague === countryValue}
                onClick={() => onChange(countryValue)}
              />
              {countryLeagues.map((league) => (
                <LeagueRow
                  key={league.id}
                  league={league}
                  count={counts.get(league.id) ?? 0}
                  isActive={activeLeague === String(league.id)}
                  onClick={() => onChange(String(league.id))}
                />
              ))}
            </div>
          );
        })}
        {visibleLeagues.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches for this date.</div>
        )}
      </div>
      {footer}
    </nav>
  );
}
