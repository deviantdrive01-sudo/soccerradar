import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fetchAllApiFootballLeagues } from "@/lib/api-football-context";
import { AdminApiFootballBrowser } from "@/components/admin-api-football-browser";

export const dynamic = "force-dynamic";

export default async function AdminLeaguesBrowsePage() {
  const supabase = createAdminSupabaseClient();
  const [{ data: leagues, error }, apiFootballLeagues] = await Promise.all([
    supabase.from("leagues").select("id, name, api_league_id"),
    fetchAllApiFootballLeagues().catch((err) => {
      console.error("Failed to fetch API-Football league catalog:", err);
      return null;
    }),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">Failed to load leagues: {error.message}</p>;
  }

  const trackedApiLeagueIds = new Set((leagues ?? []).map((l) => l.api_league_id));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leagues" className="text-xs font-medium text-primary hover:underline">
          ← Back to Leagues
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Browse API-Football leagues</h1>
        <p className="text-sm text-muted-foreground">
          Every league/cup API-Football currently tracks a season for ({apiFootballLeagues?.length ?? 0} total). Add
          one to start tracking it here, with API-Football enabled from the start. If you already track this league
          under a placeholder id, edit that row&apos;s API league ID directly on the{" "}
          <Link href="/admin/leagues" className="text-primary hover:underline">
            Leagues
          </Link>{" "}
          page instead of adding a duplicate.
        </p>
      </div>

      {apiFootballLeagues ? (
        <AdminApiFootballBrowser leagues={apiFootballLeagues} trackedApiLeagueIds={[...trackedApiLeagueIds]} />
      ) : (
        <p className="text-sm text-destructive">
          Failed to reach API-Football — check API_FOOTBALL_KEY is set and the account is active, then reload.
        </p>
      )}
    </div>
  );
}
