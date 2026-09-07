"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import { accuracyPct, pctClass } from "@/lib/accuracy";
import { cn } from "@/lib/utils";

export interface TopBookingEntry {
  id: number;
  title: string;
  ownerLabel: string;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  shareUrl: string;
  pickCount: number;
  settled: number;
  correct: number;
  publishedAt: string | null;
}

type SortMode = "recent" | "winRate";

function sortEntries(entries: TopBookingEntry[], mode: SortMode): TopBookingEntry[] {
  if (mode === "recent") {
    return [...entries].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }
  // Best win rate: unsettled bookings (0 settled picks) sort last — a 0-known
  // rate isn't a real 0%, it's "no signal yet", so it shouldn't outrank or
  // undercut bookings that have actually been graded.
  return [...entries].sort((a, b) => {
    if (a.settled === 0 && b.settled === 0) return 0;
    if (a.settled === 0) return 1;
    if (b.settled === 0) return -1;
    return accuracyPct(b.correct, b.settled) - accuracyPct(a.correct, a.settled);
  });
}

/** Accent bar color echoes the win-rate tier so the grid scans at a glance. */
function accentClass(settled: number, correct: number): string {
  if (settled === 0) return "bg-border/60";
  const pct = accuracyPct(correct, settled);
  if (pct >= 60) return "bg-emerald-500";
  if (pct >= 45) return "bg-amber-500";
  return "bg-red-500";
}

export function TopBookingsList({ entries }: { entries: TopBookingEntry[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const sorted = useMemo(() => sortEntries(entries, sortMode), [entries, sortMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 self-start rounded-md border border-border/60 p-0.5">
        {(
          [
            ["recent", "Recent"],
            ["winRate", "Best win rate"],
          ] as [SortMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSortMode(mode)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium",
              sortMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((entry) => (
          <Link
            key={entry.id}
            href={entry.shareUrl}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 transition-colors hover:border-border hover:bg-card"
          >
            <div className={cn("absolute inset-x-0 top-0 h-1", accentClass(entry.settled, entry.correct))} />
            <div className="flex flex-col gap-3 p-4 pt-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar avatarUrl={entry.ownerAvatarUrl} username={entry.ownerUsername} size="size-8" />
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold group-hover:text-primary">{entry.title}</div>
                  <div className="text-xs text-muted-foreground">
                    by {entry.ownerLabel} · {entry.pickCount} pick{entry.pickCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              {entry.settled > 0 ? (
                <Badge
                  variant="outline"
                  className={cn("w-fit text-sm font-semibold", pctClass(accuracyPct(entry.correct, entry.settled), entry.settled))}
                >
                  {entry.correct}/{entry.settled} settled · {accuracyPct(entry.correct, entry.settled)}%
                </Badge>
              ) : (
                <Badge variant="outline" className="w-fit border-border/60 text-xs text-muted-foreground">
                  Not settled yet
                </Badge>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
