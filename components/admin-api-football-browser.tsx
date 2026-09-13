"use client";

import { useMemo, useState } from "react";
import type { ApiFootballLeagueSummary } from "@/lib/api-football-context";
import { addApiFootballLeague } from "@/app/admin/(authed)/leagues/browse/actions";

const RESULT_CAP = 200; // keeps the table snappy — narrow the search/filter to see more specific results rather than rendering all ~1,237 rows unfiltered

export function AdminApiFootballBrowser({
  leagues,
  trackedApiLeagueIds,
}: {
  leagues: ApiFootballLeagueSummary[];
  trackedApiLeagueIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [statsOnly, setStatsOnly] = useState(false);

  const tracked = useMemo(() => new Set(trackedApiLeagueIds), [trackedApiLeagueIds]);

  const countries = useMemo(() => [...new Set(leagues.map((l) => l.country))].sort(), [leagues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leagues
      .filter((l) => (q ? l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q) : true))
      .filter((l) => (country ? l.country === country : true))
      .filter((l) => (statsOnly ? l.hasStatistics : true))
      .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }, [leagues, query, country, statsOnly]);

  const visible = filtered.slice(0, RESULT_CAP);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or country..."
          className="h-8 w-56 rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={statsOnly} onChange={(e) => setStatsOnly(e.target.checked)} className="size-4" />
          Has match statistics only
        </label>
        <span className="text-xs text-muted-foreground">
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
          {filtered.length > RESULT_CAP ? ` — showing first ${RESULT_CAP}, narrow your search for more` : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-1.5 font-medium">Name</th>
              <th className="p-1.5 font-medium">Country</th>
              <th className="p-1.5 font-medium">Type</th>
              <th className="p-1.5 font-medium">API-Football ID</th>
              <th className="p-1.5 font-medium text-center">Stats</th>
              <th className="p-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((league) => (
              <tr key={league.id} className="border-b border-border/60 last:border-0">
                <td className="p-1.5 font-medium">{league.name}</td>
                <td className="p-1.5 text-muted-foreground">{league.country}</td>
                <td className="p-1.5 text-muted-foreground">{league.type}</td>
                <td className="p-1.5 text-muted-foreground">{league.id}</td>
                <td className="p-1.5 text-center">
                  {league.hasStatistics ? (
                    <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      Yes
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-1.5 text-right">
                  {tracked.has(league.id) ? (
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Tracked
                    </span>
                  ) : (
                    <form action={addApiFootballLeague}>
                      <input type="hidden" name="api_league_id" value={league.id} />
                      <input type="hidden" name="name" value={league.name} />
                      <input type="hidden" name="country" value={league.country} />
                      <button
                        type="submit"
                        className="h-6 rounded-md border border-border/60 px-2 text-[11px] font-medium hover:bg-muted/60"
                      >
                        Add
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
