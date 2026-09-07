import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { PredictionDashboard } from "@/components/prediction-dashboard";
import { QUICK_FILTER_OPTIONS } from "@/lib/quick-filter";
import type { League, Prediction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/** Strip characters that would break PostgREST's `.or()`/`.in()` filter syntax if left in a search term. */
function sanitize(term: string): string {
  return term.replace(/[,()%]/g, "").trim();
}

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = await searchParams;
  const query = firstParam(q);
  return {
    title: query ? `Search: ${query}` : "Search",
    // Query-dependent results page — nothing here is worth ranking on its own.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = sanitize(firstParam(q));

  const supabase = createSupabaseReadClient();
  const { data: allLeagues } = await supabase.from("leagues").select("*");
  const leagues: League[] = allLeagues ?? [];

  let predictions: Prediction[] = [];
  let matchingLeagues: League[] = [];
  let topPicks: { slug: string; title: string }[] = [];

  if (query.length > 0) {
    const { data: leagueMatches } = await supabase
      .from("leagues")
      .select("*")
      .or(`name.ilike.%${query}%,country.ilike.%${query}%`);
    matchingLeagues = leagueMatches ?? [];
    const leagueIds = matchingLeagues.map((l) => l.id);

    const orClauses = [`home_team.ilike.%${query}%`, `away_team.ilike.%${query}%`];
    if (leagueIds.length > 0) orClauses.push(`league_id.in.(${leagueIds.join(",")})`);

    const { data: predictionMatches } = await supabase
      .from("predictions")
      .select("*")
      .or(orClauses.join(","))
      .order("match_date", { ascending: true })
      .limit(300);
    predictions = predictionMatches ?? [];

    const qLower = query.toLowerCase();
    topPicks = QUICK_FILTER_OPTIONS.filter((option) => option.collectionTitle.toLowerCase().includes(qLower)).map(
      (option) => ({ slug: option.slug, title: option.collectionTitle }),
    );
  }

  const resultCount = predictions.length + matchingLeagues.length + topPicks.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <BackLink fallbackHref="/" fallbackLabel="All predictions" />

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <span className="truncate">{query ? `Search results for “${query}”` : "Search"}</span>
        </h1>
        {query.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {resultCount === 0 ? "No results" : `${resultCount} result${resultCount === 1 ? "" : "s"}`} for “{query}”.
          </p>
        )}
      </div>

      {query.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Search for a team, league, or country using the search box above.
        </p>
      ) : resultCount === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No teams, leagues, or predictions match “{query}”.
        </p>
      ) : (
        <>
          {(matchingLeagues.length > 0 || topPicks.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {matchingLeagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/?league=${league.id}`}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium hover:bg-muted"
                >
                  {league.name}
                </Link>
              ))}
              {topPicks.map((pick) => (
                <Link
                  key={pick.slug}
                  href={`/top-picks/${pick.slug}`}
                  className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Top Picks: {pick.title}
                </Link>
              ))}
            </div>
          )}

          {predictions.length > 0 && <PredictionDashboard leagues={leagues} predictions={predictions} />}
        </>
      )}
    </main>
  );
}
