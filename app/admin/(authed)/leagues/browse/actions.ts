"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/** Adds a brand-new league row sourced from the API-Football browse page — is_active and use_api_football both start true, since picking a league here is a deliberate "track this" action, not a placeholder entry. */
export async function addApiFootballLeague(formData: FormData) {
  await verifySession();

  const apiLeagueId = Number(formData.get("api_league_id"));
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  if (!name || !country || !Number.isFinite(apiLeagueId)) return;

  const supabase = createAdminSupabaseClient();
  await supabase.from("leagues").insert({
    name,
    country,
    api_league_id: apiLeagueId,
    is_active: true,
    flashscore_slug: null,
    use_api_football: true,
  });

  revalidatePath("/admin/leagues");
  revalidatePath("/admin/leagues/browse");
}
