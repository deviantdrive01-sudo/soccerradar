"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/** Marks (or unmarks) a match as the day's marquee fixture — surfaces it in the scheduled "Top Match" Telegram broadcast. */
export async function toggleFeaturedMatch(predictionId: number, next: boolean): Promise<void> {
  await verifySession();

  const supabase = createAdminSupabaseClient();
  await supabase.from("predictions").update({ is_featured: next }).eq("id", predictionId);

  revalidatePath("/admin/matches");
}
