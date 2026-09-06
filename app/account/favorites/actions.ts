"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function toggleFavoriteCountry(country: string): Promise<{ favorited: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("favorite_countries")
    .select("id")
    .eq("user_id", user.userId)
    .eq("country", country)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorite_countries").delete().eq("id", existing.id);
    revalidatePath("/account/favorites");
    return { favorited: false };
  }

  await supabase.from("favorite_countries").insert({ user_id: user.userId, country });
  revalidatePath("/account/favorites");
  return { favorited: true };
}

export async function toggleFavoriteLeague(leagueId: number): Promise<{ favorited: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("favorite_leagues")
    .select("id")
    .eq("user_id", user.userId)
    .eq("league_id", leagueId)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorite_leagues").delete().eq("id", existing.id);
    revalidatePath("/account/favorites");
    return { favorited: false };
  }

  await supabase.from("favorite_leagues").insert({ user_id: user.userId, league_id: leagueId });
  revalidatePath("/account/favorites");
  return { favorited: true };
}

export async function toggleFavoriteMatch(predictionId: number): Promise<{ favorited: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("favorite_matches")
    .select("id")
    .eq("user_id", user.userId)
    .eq("prediction_id", predictionId)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorite_matches").delete().eq("id", existing.id);
    revalidatePath("/account/favorites");
    return { favorited: false };
  }

  await supabase.from("favorite_matches").insert({ user_id: user.userId, prediction_id: predictionId });
  revalidatePath("/account/favorites");
  return { favorited: true };
}
