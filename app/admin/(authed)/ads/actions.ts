"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function updateAdSettings(formData: FormData) {
  await verifySession();

  const houseWeight = Math.min(100, Math.max(0, Number(formData.get("house_weight")) || 0));
  const houseVideoPath = String(formData.get("house_video_path") ?? "").trim();
  const houseClickUrl = String(formData.get("house_click_url") ?? "").trim();

  if (!houseVideoPath || !houseClickUrl) return;

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("ad_settings")
    .update({
      house_weight: houseWeight,
      google_enabled: formData.get("google_enabled") === "on",
      house_video_path: houseVideoPath,
      house_click_url: houseClickUrl,
    })
    .eq("id", 1);

  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
}
