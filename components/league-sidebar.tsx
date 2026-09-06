"use client";

import { useMemo } from "react";
import { cn } from "cn";
import type { League } from "@/lib/supabase/types";

export const ALL_LEAGUES = "all";

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
      leagues: [...countryLeagues].sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.country.localeCompare(b.country));
  }, [visibleLeagues]);

  return (
    <nav className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-lg border border-border/60 bg-card/40">
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
      <div className="border-t border-border/60">
        {countryGroups.map(({ country, leagues: countryLeagues }) => (
          <div key={country}>
            <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {country}
            </div>
            {countryLeagues.map((league) => {
              const isActive = activeLeague === String(league.id);
              return (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => onChange(String(league.id))}
                  className={cn(
                    "flex w-full items-center justify-between py-2 pl-5 pr-3 text-sm transition-colors",
                    isActive ? "bg-primary font-semibold text-primary-foreground" : "text-foreground/90 hover:bg-muted",
                  )}
                >
                  <span className="truncate">{league.name}</span>
                  <span
                    className={cn(
                      "ml-2 shrink-0 text-xs font-medium",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {counts.get(league.id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {visibleLeagues.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches for this date.</div>
        )}
      </div>
      {footer}
    </nav>
  );
}
