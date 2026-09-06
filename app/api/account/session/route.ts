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
      collections: [],
    });
  }

  const [{ data: profile }, { data: countries }, { data: leagues }, { data: matches }, { data: collections }] =
    await Promise.all([
      supabase.from("profiles").select("username, is_admin").eq("id", user.id).single(),
      supabase.from("favorite_countries").select("country").eq("user_id", user.id),
      supabase.from("favorite_leagues").select("league_id").eq("user_id", user.id),
      supabase.from("favorite_matches").select("prediction_id").eq("user_id", user.id),
      supabase.from("bookmark_collections").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

  const collectionIds = (collections ?? []).map((c) => c.id);
  const { data: items } =
    collectionIds.length > 0
      ? await supabase.from("bookmark_collection_items").select("collection_id, prediction_id").in("collection_id", collectionIds)
      : { data: [] as { collection_id: number; prediction_id: number }[] };

  const predictionIdsByCollection = new Map<number, number[]>();
  for (const item of items ?? []) {
    const existing = predictionIdsByCollection.get(item.collection_id);
    if (existing) existing.push(item.prediction_id);
    else predictionIdsByCollection.set(item.collection_id, [item.prediction_id]);
  }

  return NextResponse.json({
    user: {
      userId: user.id,
      email: user.email ?? null,
      username: profile?.username ?? null,
      isAdmin: profile?.is_admin ?? false,
    },
    favorites: {
      countries: (countries ?? []).map((c) => c.country),
      leagueIds: (leagues ?? []).map((l) => l.league_id),
      matchIds: (matches ?? []).map((m) => m.prediction_id),
    },
    collections: (collections ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      predictionIds: predictionIdsByCollection.get(c.id) ?? [],
    })),
  });
}
