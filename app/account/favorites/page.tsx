import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countryFilterValue } from "@/lib/country-filter";
import { FavoriteButton } from "@/components/favorite-button";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ data: favCountries }, { data: favLeagues }, { data: favMatches }] = await Promise.all([
    supabase.from("favorite_countries").select("country").eq("user_id", user.userId).order("country"),
    supabase.from("favorite_leagues").select("league_id").eq("user_id", user.userId),
    supabase.from("favorite_matches").select("prediction_id").eq("user_id", user.userId),
  ]);

  const leagueIds = (favLeagues ?? []).map((f) => f.league_id);
  const predictionIds = (favMatches ?? []).map((f) => f.prediction_id);

  const [{ data: leagues }, { data: predictions }] = await Promise.all([
    leagueIds.length > 0
      ? supabase.from("leagues").select("id, name, country").in("id", leagueIds)
      : Promise.resolve({ data: [] as { id: number; name: string; country: string }[] }),
    predictionIds.length > 0
      ? supabase.from("predictions").select("id, home_team, away_team, match_date").in("id", predictionIds)
      : Promise.resolve({ data: [] as { id: number; home_team: string; away_team: string; match_date: string }[] }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Favorites</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.username ?? user.email}.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Countries</h2>
        {(favCountries ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No favorited countries yet.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-md border border-border/60">
            {(favCountries ?? []).map((f) => (
              <div key={f.country} className="flex items-center justify-between px-3 py-2.5">
                <Link
                  href={`/?league=${encodeURIComponent(countryFilterValue(f.country))}`}
                  className="text-sm font-medium hover:text-primary hover:underline"
                >
                  {f.country}
                </Link>
                <FavoriteButton target={{ type: "country", country: f.country }} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Leagues</h2>
        {(leagues ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No favorited leagues yet.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-md border border-border/60">
            {(leagues ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between px-3 py-2.5">
                <Link href={`/?league=${l.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                  {l.name} <span className="font-normal text-muted-foreground">({l.country})</span>
                </Link>
                <FavoriteButton target={{ type: "league", leagueId: l.id }} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Matches</h2>
        {(predictions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No favorited matches yet.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-md border border-border/60">
            {(predictions ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
                <Link href={`/match/${p.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                  {p.home_team} <span className="font-normal text-muted-foreground">vs</span> {p.away_team}
                </Link>
                <FavoriteButton target={{ type: "match", predictionId: p.id }} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
