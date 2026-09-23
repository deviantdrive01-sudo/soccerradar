import { cn } from "cn";
import type { SportFixture } from "@/lib/sports/types";

function TeamRow({ name, logo, score, isLive }: { name: string; logo?: string; score: number | null; isLive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-6 shrink-0 object-contain" loading="lazy" />
        ) : (
          <span className="size-6 shrink-0 rounded-full bg-muted" />
        )}
        <span className="truncate text-sm font-medium">{name}</span>
      </div>
      <span className={cn("text-lg font-semibold tabular-nums", isLive && "text-primary")}>
        {score ?? "–"}
      </span>
    </div>
  );
}

export function FixtureCard({ fixture }: { fixture: SportFixture }) {
  const isLive = fixture.status.state === "live";
  const kickoffLabel = new Date(fixture.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{fixture.competition.name}</span>
        <span className={cn("flex items-center gap-1 font-medium", isLive && "text-primary")}>
          {isLive && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
          {fixture.status.state === "scheduled" ? kickoffLabel : fixture.status.clock ?? fixture.status.label}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <TeamRow name={fixture.home.name} logo={fixture.home.logo} score={fixture.home.score} isLive={isLive} />
        <TeamRow name={fixture.away.name} logo={fixture.away.logo} score={fixture.away.score} isLive={isLive} />
      </div>
    </div>
  );
}
