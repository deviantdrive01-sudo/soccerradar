"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "cn";
import { HeadToHeadRow } from "@/components/sports/fixture-card";
import { Badge } from "@/components/ui/badge";
import { useLivePolling } from "@/lib/use-live-polling";
import type { FixtureDetail } from "@/lib/sports/types";

function BigTeam({ name, logo, score, isLive }: { name: string; logo?: string; score: number | null; isLive: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-16 rounded-full bg-white object-contain p-1.5" />
      ) : (
        <span className="size-16 rounded-full bg-muted" />
      )}
      <span className="text-sm font-medium">{name}</span>
      <span className={cn("text-4xl font-bold tabular-nums", isLive && "text-primary")}>{score ?? "–"}</span>
    </div>
  );
}

export default function FixtureDetailPage({ params }: { params: Promise<{ sport: string; id: string }> }) {
  const { sport, id } = use(params);
  const { data, error, loading } = useLivePolling<FixtureDetail & { error?: string }>(
    `/api/fixtures/${sport}/${id}`,
    30_000,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link href="/" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to Live
      </Link>

      {loading && !data && <p className="py-8 text-center text-sm text-muted-foreground">Loading fixture…</p>}

      {(error || data?.error) && !data?.fixture && (
        <p className="py-8 text-center text-sm text-destructive">Couldn&apos;t load this fixture: {error ?? data?.error}</p>
      )}

      {data?.fixture && (
        <>
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
            <span className="text-xs text-muted-foreground">{data.fixture.competition.name}</span>
            <div className="flex w-full items-start justify-between gap-4">
              <BigTeam
                name={data.fixture.home.name}
                logo={data.fixture.home.logo}
                score={data.fixture.home.score}
                isLive={data.fixture.status.state === "live"}
              />
              <div className="flex flex-col items-center gap-1 pt-6">
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    data.fixture.status.state === "live" && "text-primary",
                  )}
                >
                  {data.fixture.status.state === "live" && (
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  )}
                  {data.fixture.status.clock ?? data.fixture.status.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(data.fixture.kickoff).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <BigTeam
                name={data.fixture.away.name}
                logo={data.fixture.away.logo}
                score={data.fixture.away.score}
                isLive={data.fixture.status.state === "live"}
              />
            </div>
          </div>

          {data.streak && (
            <div className="flex flex-col gap-2">
              <div>
                <h2 className="text-sm font-semibold">Match Streak</h2>
                <p className="text-xs text-muted-foreground">
                  Trends from each team&apos;s last 5 matches — statistics only, not betting advice.
                </p>
              </div>
              <div className="divide-y divide-border/60 rounded-xl bg-card ring-1 ring-foreground/10">
                {data.streak.markets.map((market) => (
                  <div key={market.key} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm">{market.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{market.pick}</span>
                      <Badge variant="secondary">{market.confidence}%</Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Head-to-Head</h2>
            {data.headToHead.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous meetings on record.</p>
            ) : (
              <div className="divide-y divide-border/60 rounded-xl bg-card ring-1 ring-foreground/10">
                {data.headToHead.map((meeting) => (
                  <HeadToHeadRow key={meeting.fixture.id} meeting={meeting} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
