"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createCollection(title: string): Promise<{ id: number }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookmark_collections")
    .insert({ user_id: user.userId, title: trimmed })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create collection");

  revalidatePath("/account/collections");
  return { id: data.id };
}

export async function renameCollection(id: number, title: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const supabase = await createSupabaseServerClient();
  await supabase.from("bookmark_collections").update({ title: trimmed }).eq("id", id).eq("user_id", user.userId);

  revalidatePath("/account/collections");
  revalidatePath(`/collections/${id}`);
}

export async function deleteCollection(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  await supabase.from("bookmark_collections").delete().eq("id", id).eq("user_id", user.userId);

  revalidatePath("/account/collections");
  revalidatePath(`/collections/${id}`);
}

export async function toggleCollectionItem(collectionId: number, predictionId: number): Promise<{ added: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("bookmark_collection_items")
    .select("id")
    .eq("collection_id", collectionId)
    .eq("prediction_id", predictionId)
    .maybeSingle();

  if (existing) {
    await supabase.from("bookmark_collection_items").delete().eq("id", existing.id);
    revalidatePath(`/collections/${collectionId}`);
    return { added: false };
  }

  await supabase.from("bookmark_collection_items").insert({ collection_id: collectionId, prediction_id: predictionId });
  revalidatePath(`/collections/${collectionId}`);
  return { added: true };
}
