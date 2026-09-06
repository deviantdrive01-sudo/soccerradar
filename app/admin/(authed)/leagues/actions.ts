"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function nullableText(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateLeague(formData: FormData) {
  await verifySession();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("leagues")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      is_active: formData.get("is_active") === "on",
      flashscore_slug: nullableText(formData.get("flashscore_slug")),
    })
    .eq("id", id);

  revalidatePath("/admin/leagues");
}

export async function createLeague(formData: FormData) {
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
    flashscore_slug: nullableText(formData.get("flashscore_slug")),
  });

  revalidatePath("/admin/leagues");
}
