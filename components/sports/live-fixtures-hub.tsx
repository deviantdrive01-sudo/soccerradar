"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FixtureCard } from "@/components/sports/fixture-card";
import { useLivePolling } from "@/lib/use-live-polling";
import type { Sport, SportFixture } from "@/lib/sports/types";
import { todayKey } from "@/lib/date-key";

type SportFilter = Sport | "all";
type StatusFilter = "live" | "today" | "tomorrow";

const SPORT_OPTIONS: { value: SportFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
];

function tomorrowKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fixturesUrl(sport: SportFilter, status: StatusFilter): string {
  const params = new URLSearchParams();
  if (sport !== "all") params.set("sport", sport);
  if (status === "live") {
    params.set("status", "live");
  } else {
    params.set("date", status === "today" ? todayKey() : tomorrowKey());
  }
  return `/api/fixtures?${params.toString()}`;
}

export function LiveFixturesHub() {
  const [sport, setSport] = useState<SportFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("live");

  const url = useMemo(() => fixturesUrl(sport, status), [sport, status]);
  const { data, error, loading } = useLivePolling<{ fixtures: SportFixture[]; error?: string }>(
    url,
    status === "live" ? 20_000 : 60_000,
  );

  const fixtures = data?.fixtures ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SPORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSport(opt.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              sport === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && fixtures.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading fixtures…</p>
      )}

      {error && fixtures.length === 0 && !loading && (
        <p className="py-8 text-center text-sm text-destructive">Couldn&apos;t load fixtures: {error}</p>
      )}

      {!loading && !error && fixtures.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {status === "live" ? "No matches live right now." : "No fixtures scheduled."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {fixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} />
        ))}
      </div>
    </div>
  );
}
