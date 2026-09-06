"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketKey } from "@/lib/hydrate";

export async function createBooker(title: string): Promise<{ id: number }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookers")
    .insert({ user_id: user.userId, title: trimmed })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create booker");

  revalidatePath("/account/bookers");
  return { id: data.id };
}

export async function renameBooker(id: number, title: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createSupabaseServerClient();
  await supabase.from("bookers").update({ title: trimmed }).eq("id", id).eq("user_id", user.userId);

  revalidatePath("/account/bookers");
  revalidatePath(`/bookers/${id}`);
}

export async function deleteBooker(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  await supabase.from("bookers").delete().eq("id", id).eq("user_id", user.userId);

  revalidatePath("/account/bookers");
  revalidatePath(`/bookers/${id}`);
}

export async function toggleBookerItem(
  bookerId: number,
  predictionId: number,
  marketKey: MarketKey,
): Promise<{ added: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("booker_items")
    .select("id")
    .eq("booker_id", bookerId)
    .eq("prediction_id", predictionId)
    .eq("market_key", marketKey)
    .maybeSingle();

  if (existing) {
    await supabase.from("booker_items").delete().eq("id", existing.id);
    revalidatePath(`/bookers/${bookerId}`);
    return { added: false };
  }

  await supabase.from("booker_items").insert({ booker_id: bookerId, prediction_id: predictionId, market_key: marketKey });
  revalidatePath(`/bookers/${bookerId}`);
  return { added: true };
}
