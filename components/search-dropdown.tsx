"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Prediction } from "@/lib/supabase/types";

type SearchResult = Prediction & { league_name: string };
interface TopPickResult {
  slug: string;
  title: string;
}

/**
 * Live results as you type, queried straight from the database rather than
 * only the predictions already loaded into the page — so search can surface
 * a match outside the current 7-day window or the active league/date tab.
 * Also surfaces matching /top-picks/[slug] collections (e.g. "corners").
 */
export function SearchDropdown({ query }: { query: string }) {
  const [state, setState] = useState<{ query: string; results: SearchResult[]; topPicks: TopPickResult[] } | null>(
    null,
  );
  const [errored, setErrored] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) =>
          setState({ query: trimmed, results: data.predictions ?? [], topPicks: data.topPicks ?? [] }),
        )
        .catch((err) => {
          if (err.name !== "AbortError") setErrored(true);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (trimmed.length < 1) return null;

  const loading = state?.query !== trimmed;
  const results = loading ? [] : (state?.results ?? []);
  const topPicks = loading ? [] : (state?.topPicks ?? []);

  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-md border border-border/60 bg-popover shadow-lg">
      {loading ? (
        <div className="p-3 text-sm text-muted-foreground">Searching…</div>
      ) : errored ? (
        <div className="p-3 text-sm text-muted-foreground">Search is unavailable right now.</div>
      ) : results.length === 0 && topPicks.length === 0 ? (
        <div className="p-3 text-sm text-muted-foreground">No matches for &ldquo;{trimmed}&rdquo;.</div>
      ) : (
        <>
          {topPicks.length > 0 && (
            <div className="border-b border-border/40">
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top Picks
              </div>
              {topPicks.map((pick) => (
                <Link
                  key={pick.slug}
                  href={`/top-picks/${pick.slug}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">Top Predictions Today: {pick.title}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/match/${r.id}`}
              className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-sm last:border-0 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {r.home_team} <span className="font-normal text-muted-foreground">vs</span> {r.away_team}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.league_name} ·{" "}
                  {new Date(r.match_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{r.confidence}%</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
