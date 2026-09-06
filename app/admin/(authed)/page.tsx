import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/** Impure by nature (reads the clock) — kept out of the component body so it isn't flagged as a render-purity violation. */
function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const supabase = createAdminSupabaseClient();

  const sevenDaysAgo = sevenDaysAgoIso();

  const [
    { count: activeLeagues },
    { count: inactiveLeagues },
    { count: settledPredictions },
    { count: pendingPredictions },
    { data: recentAdEvents },
  ] = await Promise.all([
    supabase.from("leagues").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("leagues").select("*", { count: "exact", head: true }).eq("is_active", false),
    supabase.from("predictions").select("*", { count: "exact", head: true }).not("actual_result", "is", null),
    supabase.from("predictions").select("*", { count: "exact", head: true }).is("actual_result", null),
    supabase.from("ad_events").select("event_type").gte("created_at", sevenDaysAgo),
  ]);

  const impressions = (recentAdEvents ?? []).filter((e) => e.event_type === "impression").length;
  const clicks = (recentAdEvents ?? []).filter((e) => e.event_type === "click").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Active leagues" value={activeLeagues ?? 0} />
        <Tile label="Inactive leagues" value={inactiveLeagues ?? 0} />
        <Tile label="Settled predictions" value={settledPredictions ?? 0} />
        <Tile label="Pending predictions" value={pendingPredictions ?? 0} />
        <Tile label="Ad impressions (7d)" value={impressions} />
        <Tile label="Ad clicks (7d)" value={clicks} />
      </div>
    </div>
  );
}
