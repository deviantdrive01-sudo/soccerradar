import { cn } from "cn";
import type { HeadToHeadMeeting, SportFixture } from "@/lib/sports/types";

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
 */
export function FixtureRow({ fixture }: { fixture: SportFixture }) {
  const isLive = fixture.status.state === "live";
  const kickoffLabel = new Date(fixture.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const statusLabel = fixture.status.state === "scheduled" ? kickoffLabel : fixture.status.clock ?? fixture.status.label;

  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-2 px-4 py-3">
      <TeamCrest name={fixture.home.name} logo={fixture.home.logo} />
      <span className={cn("min-w-6 text-right text-xl font-semibold tabular-nums", isLive && "text-primary")}>
        {fixture.home.score ?? "–"}
      </span>

      <div className="flex flex-col items-center gap-0.5 px-1 text-center">
        <span className="truncate text-[11px] text-muted-foreground">{fixture.competition.name}</span>
        <span className={cn("flex items-center gap-1 text-[11px] font-medium", isLive && "text-primary")}>
          {isLive && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
          {statusLabel}
        </span>
      </div>

      <span className={cn("min-w-6 text-left text-xl font-semibold tabular-nums", isLive && "text-primary")}>
        {fixture.away.score ?? "–"}
      </span>
      <TeamCrest name={fixture.away.name} logo={fixture.away.logo} />
    </div>
  );
}

/**
 * One past-meeting row for the head-to-head list: final score + date/
 * competition on the left, per-team shots/corners/cards on the right when
 * the provider has stats for that fixture.
 */
export function HeadToHeadRow({ meeting }: { meeting: HeadToHeadMeeting }) {
  const { fixture, stats } = meeting;
  const dateLabel = new Date(fixture.kickoff).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {fixture.home.name} {fixture.home.score}–{fixture.away.score} {fixture.away.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {dateLabel} · {fixture.competition.name}
        </p>
      </div>
      {stats && (
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>
            Shots {stats.shots.home ?? "–"}–{stats.shots.away ?? "–"}
          </p>
          <p>
            Corners {stats.corners.home ?? "–"}–{stats.corners.away ?? "–"}
          </p>
          <p>
            Cards {stats.cards.home ?? "–"}–{stats.cards.away ?? "–"}
          </p>
        </div>
      )}
    </div>
  );
}
