import { NextRequest, NextResponse } from "next/server";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { QUICK_FILTER_OPTIONS } from "@/lib/quick-filter";

export const dynamic = "force-dynamic";

/** Strip characters that would break PostgREST's `.or()`/`.in()` filter syntax if left in a search term. */
function sanitize(term: string): string {
  return term.replace(/[,()%]/g, "").trim();
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = sanitize(raw);
  if (q.length < 1) return NextResponse.json({ predictions: [], topPicks: [] });

  const supabase = createSupabaseReadClient();

  const { data: matchingLeagues } = await supabase
    .from("leagues")
    .select("id")
    .or(`name.ilike.%${q}%,country.ilike.%${q}%`);
  const leagueIds = (matchingLeagues ?? []).map((l) => l.id);

  const orClauses = [`home_team.ilike.%${q}%`, `away_team.ilike.%${q}%`];
  if (leagueIds.length > 0) orClauses.push(`league_id.in.(${leagueIds.join(",")})`);

  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("*")
    .or(orClauses.join(","))
    .order("match_date", { ascending: true })
    .limit(8);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: leagues } = await supabase.from("leagues").select("id, name");
  const leagueNameById = new Map((leagues ?? []).map((l) => [l.id, l.name]));

  const qLower = q.toLowerCase();
  const topPicks = QUICK_FILTER_OPTIONS.filter((option) => option.collectionTitle.toLowerCase().includes(qLower)).map(
    (option) => ({ slug: option.slug, title: option.collectionTitle }),
  );

  return NextResponse.json({
    predictions: (predictions ?? []).map((p) => ({ ...p, league_name: leagueNameById.get(p.league_id) ?? "" })),
    topPicks,
  });
}
