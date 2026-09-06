import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      user: null,
      favorites: { countries: [], leagueIds: [], matchIds: [] },
    });
  }

  const [{ data: profile }, { data: countries }, { data: leagues }, { data: matches }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase.from("favorite_countries").select("country").eq("user_id", user.id),
    supabase.from("favorite_leagues").select("league_id").eq("user_id", user.id),
    supabase.from("favorite_matches").select("prediction_id").eq("user_id", user.id),
  ]);

  return NextResponse.json({
    user: { userId: user.id, email: user.email ?? null, username: profile?.username ?? null },
    favorites: {
      countries: (countries ?? []).map((c) => c.country),
      leagueIds: (leagues ?? []).map((l) => l.league_id),
      matchIds: (matches ?? []).map((m) => m.prediction_id),
    },
  });
}
