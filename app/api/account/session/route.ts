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
      bookings: [],
    });
  }

  const [
    { data: profile },
    { data: countries },
    { data: leagues },
    { data: matches },
    { data: collections },
    { data: bookings },
  ] = await Promise.all([
    supabase.from("profiles").select("username, role, avatar_url").eq("id", user.id).single(),
    supabase.from("favorite_countries").select("country").eq("user_id", user.id),
    supabase.from("favorite_leagues").select("league_id").eq("user_id", user.id),
    supabase.from("favorite_matches").select("prediction_id").eq("user_id", user.id),
    supabase.from("bookmark_collections").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("bookings").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const collectionIds = (collections ?? []).map((c) => c.id);
  const { data: collectionItems } =
    collectionIds.length > 0
      ? await supabase.from("bookmark_collection_items").select("collection_id, prediction_id").in("collection_id", collectionIds)
      : { data: [] as { collection_id: number; prediction_id: number }[] };

  const predictionIdsByCollection = new Map<number, number[]>();
  for (const item of collectionItems ?? []) {
    const existing = predictionIdsByCollection.get(item.collection_id);
    if (existing) existing.push(item.prediction_id);
    else predictionIdsByCollection.set(item.collection_id, [item.prediction_id]);
  }

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const { data: bookingItems } =
    bookingIds.length > 0
      ? await supabase.from("booking_items").select("booking_id, prediction_id, market_key").in("booking_id", bookingIds)
      : { data: [] as { booking_id: number; prediction_id: number; market_key: string }[] };

  const itemsByBooking = new Map<number, { predictionId: number; marketKey: string }[]>();
  for (const item of bookingItems ?? []) {
    const entry = { predictionId: item.prediction_id, marketKey: item.market_key };
    const existing = itemsByBooking.get(item.booking_id);
    if (existing) existing.push(entry);
    else itemsByBooking.set(item.booking_id, [entry]);
  }

  return NextResponse.json({
    user: {
      userId: user.id,
      email: user.email ?? null,
      username: profile?.username ?? null,
      role: profile?.role ?? "user",
      avatarUrl: profile?.avatar_url ?? null,
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
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      items: itemsByBooking.get(b.id) ?? [],
    })),
  });
}
