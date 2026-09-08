import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminFeatureMatchToggle } from "@/components/admin-feature-match-toggle";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <p className="text-sm text-muted-foreground">
          Predicted matches over the next 48h. Mark a match &ldquo;Featured&rdquo; to include it in the scheduled
          &ldquo;Top Match&rdquo; Telegram broadcast — any number of matches can be featured on a given day.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">League</th>
              <th className="px-3 py-2">Kickoff (UTC)</th>
              <th className="px-3 py-2 text-right">Feature</th>
            </tr>
          </thead>
          <tbody>
            {(predictions ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium">
                  {p.home_team} <span className="text-muted-foreground">vs</span> {p.away_team}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{leagueById.get(p.league_id) ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(p.match_date).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                </td>
                <td className="px-3 py-2 text-right">
                  <AdminFeatureMatchToggle predictionId={p.id} initialFeatured={p.is_featured} />
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
