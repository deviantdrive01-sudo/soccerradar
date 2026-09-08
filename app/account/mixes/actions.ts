"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketKey } from "@/lib/hydrate";

export async function createBooking(title: string): Promise<{ id: number }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({ user_id: user.userId, title: trimmed })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create booking");

  revalidatePath("/account/mixes");
  return { id: data.id };
}

export async function renameBooking(id: number, title: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createSupabaseServerClient();
  await supabase.from("bookings").update({ title: trimmed }).eq("id", id).eq("user_id", user.userId);

  revalidatePath("/account/mixes");
  revalidatePath(`/mixes/${id}`);
}

export async function deleteBooking(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  await supabase.from("bookings").delete().eq("id", id).eq("user_id", user.userId);

  revalidatePath("/account/mixes");
  revalidatePath(`/mixes/${id}`);
}

export async function setBookingVisibility(id: number, isPublic: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("bookings")
    .select("published_at")
    .eq("id", id)
    .eq("user_id", user.userId)
    .maybeSingle();

  await supabase
    .from("bookings")
    .update({
      is_public: isPublic,
      published_at: isPublic ? (current?.published_at ?? new Date().toISOString()) : (current?.published_at ?? null),
    })
    .eq("id", id)
    .eq("user_id", user.userId);

  revalidatePath("/account/mixes");
  revalidatePath(`/mixes/${id}`);
  revalidatePath("/top-mixes");
}

export async function toggleBookingItem(
  bookingId: number,
  predictionId: number,
  marketKey: MarketKey,
  /** The user's own call for this market, when it diverges from SoccerRadar's prediction. Omit/null to just track SoccerRadar's own call. */
  userValue?: string | null,
): Promise<{ added: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("booking_items")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("prediction_id", predictionId)
    .eq("market_key", marketKey)
    .maybeSingle();

  if (existing) {
    await supabase.from("booking_items").delete().eq("id", existing.id);
    revalidatePath(`/mixes/${bookingId}`);
    return { added: false };
  }

  await supabase
    .from("booking_items")
    .insert({ booking_id: bookingId, prediction_id: predictionId, market_key: marketKey, user_value: userValue ?? null });
  revalidatePath(`/mixes/${bookingId}`);
  return { added: true };
}
