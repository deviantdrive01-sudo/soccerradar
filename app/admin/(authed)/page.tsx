import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ListTodo, CalendarClock, CheckCircle2, Target, Trophy, MousePointerClick, Clock, ArrowUpRight, Send, Link2 } from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { computeAccuracy, accuracyPct } from "@/lib/accuracy";
import { summarizeSettledMarkets, settledMarketTally } from "@/lib/hydrate";
import { getChannelMemberCount } from "@/lib/telegram";
import type { Prediction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/** Impure by nature (reads the clock) — kept out of the component body so it isn't flagged as a render-purity violation. */
function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function kickoffLabel(matchDate: string): string {
  return new Date(matchDate).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Same 60/45 thresholds as lib/accuracy.ts's pctClass, as a dot color instead of a badge. */
function activityDotClass(pct: number, known: number): string {
  if (known === 0) return "bg-muted-foreground";
  if (pct >= 60) return "bg-emerald-400";
  if (pct >= 45) return "bg-amber-400";
  return "bg-red-400";
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const STAT_TONE_CLASSES = {
  lime: "bg-primary/15 text-primary",
  sky: "bg-sky-400/15 text-sky-400",
  violet: "bg-violet-400/15 text-violet-400",
  amber: "bg-amber-400/15 text-amber-400",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "lime",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: keyof typeof STAT_TONE_CLASSES;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", STAT_TONE_CLASSES[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground/50" />}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
      </div>
      {sub && <div className="text-[11px] text-muted-foreground/80">{sub}</div>}
    </>
  );

  const className = "space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 transition-colors";
  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:border-primary/40")}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export default async function AdminOverviewPage() {
  const supabase = createAdminSupabaseClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const in48hIso = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const sevenDaysAgo = sevenDaysAgoIso();

  const [
    { count: activeLeagues },
    { count: needsPredictionCount },
    { count: upcoming48hCount },
    { data: settledRows },
    { data: upcomingRows },
    { data: needsPredictionRows },
    { data: leagues },
    { data: recentAdEvents },
    { count: linkedTelegramCount },
    channelMemberCount,
  ] = await Promise.all([
    supabase.from("leagues").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("predictions").select("*", { count: "exact", head: true }).is("markets", null),
    supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .not("markets", "is", null)
      .is("actual_result", null)
      .gte("match_date", nowIso)
      .lte("match_date", in48hIso),
    supabase.from("predictions").select("*").not("actual_result", "is", null),
    supabase
      .from("predictions")
      .select("id, league_id, home_team, away_team, match_date, confidence")
      .not("markets", "is", null)
      .is("actual_result", null)
      .gte("match_date", nowIso)
      .order("match_date", { ascending: true })
      .limit(4),
    supabase
      .from("predictions")
      .select("id, league_id, home_team, away_team, match_date")
      .is("markets", null)
      .order("match_date", { ascending: true })
      .limit(5),
    supabase.from("leagues").select("id, name, country"),
    supabase.from("ad_events").select("event_type").gte("created_at", sevenDaysAgo),
    supabase.from("telegram_links").select("*", { count: "exact", head: true }).not("linked_at", "is", null),
    getChannelMemberCount(),
  ]);

  const leagueLabelById = new Map((leagues ?? []).map((l) => [l.id, `${l.country} · ${l.name}`]));

  const settled = (settledRows ?? []) as Prediction[];
  const accuracy = computeAccuracy(settled);
  const overallPct = accuracyPct(accuracy.overallCorrect, accuracy.overallKnown);
  const settledThisWeek = settled.filter((p) => p.match_date >= sevenDaysAgo).length;

  const recentActivity = [...settled]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6)
    .map((p) => {
      const tally = p.markets ? settledMarketTally(summarizeSettledMarkets(p.markets, p.actual_result!.markets)) : null;
      return { prediction: p, tally };
    });

  const impressions = (recentAdEvents ?? []).filter((e) => e.event_type === "impression").length;
  const clicks = (recentAdEvents ?? []).filter((e) => e.event_type === "click").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across predictions right now.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={ListTodo}
          label="Needs predictions"
          value={needsPredictionCount ?? 0}
          sub="Crawled fixtures awaiting a model run"
          tone="amber"
        />
        <StatCard
          icon={CalendarClock}
          label="Upcoming (48h)"
          value={upcoming48hCount ?? 0}
          sub="Predicted, not yet kicked off"
          tone="sky"
          href="/admin/matches"
        />
        <StatCard
          icon={CheckCircle2}
          label="Settled predictions"
          value={accuracy.totalSettled}
          sub={`+${settledThisWeek} in the last 7 days`}
          tone="violet"
        />
        <StatCard
          icon={Target}
          label="Overall accuracy"
          value={accuracy.overallKnown ? `${overallPct}%` : "–"}
          sub={`${accuracy.overallCorrect}/${accuracy.overallKnown} markets correct`}
          tone="lime"
          href="/accuracy"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Trophy} label="Active leagues" value={activeLeagues ?? 0} tone="lime" href="/admin/leagues" />
        <StatCard
          icon={MousePointerClick}
          label="Ad engagement (7d)"
          value={`${impressions} impr`}
          sub={`${clicks} click${clicks === 1 ? "" : "s"}`}
          tone="sky"
          href="/admin/ads"
        />
        <StatCard
          icon={Send}
          label="Telegram channel"
          value={channelMemberCount !== null ? channelMemberCount.toLocaleString() : "–"}
          sub="Live subscriber count"
          tone="sky"
          href="/admin/telegram"
        />
        <StatCard
          icon={Link2}
          label="Linked accounts"
          value={linkedTelegramCount ?? 0}
          sub="Accounts connected for notifications"
          tone="violet"
          href="/admin/telegram"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming matches</h2>
          <Link href="/admin/matches" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {upcomingRows && upcomingRows.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingRows.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="truncate">{leagueLabelById.get(m.league_id) ?? "Unknown league"}</span>
                  {m.confidence !== null && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">{m.confidence}%</span>
                  )}
                </div>
                <div className="text-sm font-semibold leading-tight">
                  {m.home_team} <span className="font-normal text-muted-foreground">vs</span> {m.away_team}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {kickoffLabel(m.match_date)}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing predicted in the next 48 hours.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Needs predictions</h2>
          <div className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-2">
            {needsPredictionRows && needsPredictionRows.length > 0 ? (
              needsPredictionRows.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {m.home_team} vs {m.away_team}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {leagueLabelById.get(m.league_id) ?? "Unknown league"} · {kickoffLabel(m.match_date)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    Pending
                  </span>
                </div>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">Every crawled fixture has a prediction.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h2>
          <div className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-2">
            {recentActivity.length > 0 ? (
              recentActivity.map(({ prediction: p, tally }) => (
                <Link
                  key={p.id}
                  href={`/match/${p.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      tally ? activityDotClass(accuracyPct(tally.correct, tally.known), tally.known) : "bg-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {p.home_team} vs {p.away_team} settled
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tally ? `${tally.correct}/${tally.known} correct` : "No prediction was made"} · {relativeTime(p.updated_at)}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">No settled predictions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
