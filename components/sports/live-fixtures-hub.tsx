"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FixtureRow } from "@/components/sports/fixture-card";
import { useLivePolling } from "@/lib/use-live-polling";
import type { Sport, SportFixture } from "@/lib/sports/types";
import { todayKey } from "@/lib/date-key";

type StatusFilter = "live" | "today" | "tomorrow";
type CompetitionFilter = number | "all";

// Basketball needs its own API_SPORTS_KEY, not configured yet — shown as
// "Soon" and disabled rather than removed, so the pivot's end state stays
// visible in the UI.
const SPORT_OPTIONS: { value: Sport; label: string; disabled?: boolean }[] = [
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball", disabled: true },
];

function tomorrowKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fixturesUrl(sport: Sport, status: StatusFilter): string {
  const params = new URLSearchParams();
  params.set("sport", sport);
  if (status === "live") {
    params.set("status", "live");
  } else {
    params.set("date", status === "today" ? todayKey() : tomorrowKey());
  }
  return `/api/fixtures?${params.toString()}`;
}

const EMPTY_FIXTURES: SportFixture[] = [];

/** Distinct competitions present in the current fixture list, in first-seen order — powers the icon rail. */
function competitionsIn(fixtures: SportFixture[]) {
  const seen = new Map<number, SportFixture["competition"]>();
  for (const fixture of fixtures) {
    if (!seen.has(fixture.competition.id)) seen.set(fixture.competition.id, fixture.competition);
  }
  return Array.from(seen.values());
}

export function LiveFixturesHub() {
  const [sport, setSport] = useState<Sport>("football");
  const [status, setStatus] = useState<StatusFilter>("live");
  const [competitionId, setCompetitionId] = useState<CompetitionFilter>("all");

  const url = useMemo(() => fixturesUrl(sport, status), [sport, status]);
  const { data, error, loading } = useLivePolling<{ fixtures: SportFixture[]; error?: string }>(
    url,
    status === "live" ? 20_000 : 60_000,
  );

  const fixtures = data?.fixtures ?? EMPTY_FIXTURES;
  const competitions = useMemo(() => competitionsIn(fixtures), [fixtures]);

  // Derived rather than synced via an effect: if the previously-picked
  // competition has dropped out of the current fixture list (sport/date
  // changed, or it simply has no games right now), fall back to "all"
  // without a stateful reset.
  const activeCompetitionId: CompetitionFilter =
    competitionId !== "all" && competitions.some((c) => c.id === competitionId) ? competitionId : "all";

  const visibleFixtures =
    activeCompetitionId === "all" ? fixtures : fixtures.filter((f) => f.competition.id === activeCompetitionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SPORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => setSport(opt.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              opt.disabled
                ? "cursor-not-allowed bg-muted text-muted-foreground/50"
                : sport === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {opt.label}
            {opt.disabled && <span className="ml-1.5 text-[10px] uppercase">Soon</span>}
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

      {competitions.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCompetitionId("all")}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full text-[10px] font-semibold",
                activeCompetitionId === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              All
            </span>
          </button>
          {competitions.map((competition) => (
            <button
              key={competition.id}
              type="button"
              onClick={() => setCompetitionId(competition.id)}
              className="flex shrink-0 flex-col items-center gap-1"
              aria-label={competition.name}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full bg-white p-1.5 ring-2 transition-colors",
                  activeCompetitionId === competition.id ? "ring-primary" : "ring-transparent",
                )}
              >
                {competition.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={competition.logo} alt="" className="size-full object-contain" loading="lazy" />
                ) : (
                  <span className="size-full rounded-full bg-muted" />
                )}
              </span>
            </button>
          ))}
        </div>
      )}

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

      {visibleFixtures.length > 0 && (
        <div className="divide-y divide-border/60 rounded-xl bg-card ring-1 ring-foreground/10">
          {visibleFixtures.map((fixture) => (
            <Link
              key={fixture.id}
              href={`/fixtures/${fixture.sport}/${fixture.id.slice(fixture.sport.length + 1)}`}
              className="block transition-colors hover:bg-muted/40"
            >
              <FixtureRow fixture={fixture} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
