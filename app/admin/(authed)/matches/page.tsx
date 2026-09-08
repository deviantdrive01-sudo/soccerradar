import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminFeatureMatchToggle } from "@/components/admin-feature-match-toggle";
import { cn } from "@/lib/utils";
import {
  ADMIN_MOBILE_LIST,
  ADMIN_CARD,
  ADMIN_TABLE_WRAPPER,
  ADMIN_TABLE,
  ADMIN_TH,
  ADMIN_TH_LEFT,
  ADMIN_TD,
  ADMIN_ROW_BORDER,
  ADMIN_HEADER_ROW,
} from "@/lib/admin/list-styles";

export const dynamic = "force-dynamic";

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

export default async function AdminMatchesPage() {
  const supabase = createAdminSupabaseClient();

  const now = new Date();
  const twoDaysAhead = new Date(now.getTime() + 48 * 3600 * 1000);
  const [{ data: predictions }, { data: leagues }] = await Promise.all([
    supabase
      .from("predictions")
      .select("id, league_id, home_team, away_team, match_date, is_featured")
      .not("markets", "is", null)
      .gte("match_date", now.toISOString())
      .lte("match_date", twoDaysAhead.toISOString())
      .order("match_date", { ascending: true }),
    supabase.from("leagues").select("id, name, country"),
  ]);

  const leagueById = new Map((leagues ?? []).map((l) => [l.id, `${l.country} · ${l.name}`]));
  const featuredCount = (predictions ?? []).filter((p) => p.is_featured).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <p className="text-sm text-muted-foreground">
          {(predictions ?? []).length} predicted match{(predictions ?? []).length === 1 ? "" : "es"} over the next
          48h · {featuredCount} featured. Mark a match &ldquo;Featured&rdquo; to include it in the scheduled &ldquo;Top
          Match&rdquo; Telegram broadcast — any number of matches can be featured on a given day.
        </p>
      </div>

      {/* Phone: stacked cards — the table below needs 640px+ to read without horizontal scrolling. */}
      <div className={ADMIN_MOBILE_LIST}>
        {(predictions ?? []).map((p) => (
          <div key={p.id} className={ADMIN_CARD}>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate font-medium">
                {p.home_team} <span className="text-muted-foreground">vs</span> {p.away_team}
              </span>
              <div className="shrink-0">
                <AdminFeatureMatchToggle predictionId={p.id} initialFeatured={p.is_featured} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">League</div>
                <span className="text-muted-foreground">{leagueById.get(p.league_id) ?? "—"}</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Kickoff (UTC)</div>
                <span className="text-muted-foreground">{kickoffLabel(p.match_date)}</span>
              </div>
            </div>
          </div>
        ))}
        {(predictions ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No predicted matches in the next 48h.</p>
        )}
      </div>

      {/* sm+: table */}
      <div className={ADMIN_TABLE_WRAPPER}>
        <table className={cn(ADMIN_TABLE, "min-w-[640px]")}>
          <thead>
            <tr className={ADMIN_HEADER_ROW}>
              <th className={ADMIN_TH_LEFT}>Match</th>
              <th className={ADMIN_TH_LEFT}>League</th>
              <th className={ADMIN_TH_LEFT}>Kickoff (UTC)</th>
              <th className={cn(ADMIN_TH, "text-right")}>Feature</th>
            </tr>
          </thead>
          <tbody>
            {(predictions ?? []).map((p) => (
              <tr key={p.id} className={ADMIN_ROW_BORDER}>
                <td className={cn(ADMIN_TD, "font-medium")}>
                  {p.home_team} <span className="text-muted-foreground">vs</span> {p.away_team}
                </td>
                <td className={cn(ADMIN_TD, "text-muted-foreground")}>{leagueById.get(p.league_id) ?? "—"}</td>
                <td className={cn(ADMIN_TD, "whitespace-nowrap text-muted-foreground")}>{kickoffLabel(p.match_date)}</td>
                <td className={ADMIN_TD}>
                  <div className="flex items-center justify-end">
                    <AdminFeatureMatchToggle predictionId={p.id} initialFeatured={p.is_featured} />
                  </div>
                </td>
              </tr>
            ))}
            {(predictions ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No predicted matches in the next 48h.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
