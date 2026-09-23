import { cn } from "cn";
import type { SportFixture } from "@/lib/sports/types";

function TeamCrest({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-8 rounded-full bg-white object-contain p-0.5" loading="lazy" />
      ) : (
        <span className="size-8 shrink-0 rounded-full bg-muted" />
      )}
      <span className="w-full truncate text-center text-[11px] leading-tight text-muted-foreground">{name}</span>
    </div>
  );
}

/**
 * One scoreboard row: crest+name on the outside, score flanking a centered
 * competition/status column — mirrors the Apple Sports card layout.
 * `showDate` swaps the status line for the fixture's date, for
 * head-to-head lists where matches can span many months.
 */
export function FixtureRow({ fixture, showDate }: { fixture: SportFixture; showDate?: boolean }) {
  const isLive = fixture.status.state === "live";
  const kickoffLabel = new Date(fixture.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = new Date(fixture.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const statusLabel = fixture.status.state === "scheduled" ? kickoffLabel : fixture.status.clock ?? fixture.status.label;

  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-2 px-4 py-3">
      <TeamCrest name={fixture.home.name} logo={fixture.home.logo} />
      <span className={cn("min-w-6 text-right text-xl font-semibold tabular-nums", isLive && "text-primary")}>
        {fixture.home.score ?? "–"}
      </span>

      <div className="flex flex-col items-center gap-0.5 px-1 text-center">
        <span className="truncate text-[11px] text-muted-foreground">{fixture.competition.name}</span>
        {showDate ? (
          <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
        ) : (
          <span className={cn("flex items-center gap-1 text-[11px] font-medium", isLive && "text-primary")}>
            {isLive && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
            {statusLabel}
          </span>
        )}
      </div>

      <span className={cn("min-w-6 text-left text-xl font-semibold tabular-nums", isLive && "text-primary")}>
        {fixture.away.score ?? "–"}
      </span>
      <TeamCrest name={fixture.away.name} logo={fixture.away.logo} />
    </div>
  );
}
