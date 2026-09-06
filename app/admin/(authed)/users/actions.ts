"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const PERMANENT_BAN = "876000h"; // ~100 years — Supabase Auth has no literal "forever", this is the practical equivalent

export async function toggleUserBan(formData: FormData): Promise<void> {
  const session = await verifySession();
  const userId = String(formData.get("userId") ?? "");
  const currentlyBanned = formData.get("currentlyBanned") === "true";
  if (!userId || userId === session.userId) return; // can't disable your own account

  const supabase = createAdminSupabaseClient();
  await supabase.auth.admin.updateUserById(userId, {
    ban_duration: currentlyBanned ? "none" : PERMANENT_BAN,
  });

  revalidatePath("/admin/users");
}

export async function toggleUserAdmin(formData: FormData): Promise<void> {
  const session = await verifySession();
  const userId = String(formData.get("userId") ?? "");
  const currentlyAdmin = formData.get("currentlyAdmin") === "true";
  if (!userId || userId === session.userId) return; // can't change your own admin status here

  const supabase = createAdminSupabaseClient();
  await supabase.from("profiles").update({ is_admin: !currentlyAdmin }).eq("id", userId);

  revalidatePath("/admin/users");
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const session = await verifySession();
  if (!userId || userId === session.userId) throw new Error("Cannot delete your own account");

  const supabase = createAdminSupabaseClient();
  await supabase.auth.admin.deleteUser(userId);

  revalidatePath("/admin/users");
}
