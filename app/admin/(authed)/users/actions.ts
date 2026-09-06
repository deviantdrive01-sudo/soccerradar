"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ProfileRole } from "@/lib/supabase/types";

const PERMANENT_BAN = "876000h"; // ~100 years — Supabase Auth has no literal "forever", this is the practical equivalent

/**
 * A plain "admin" can only disable/enable regular ("user") accounts — never
 * another admin's or a super_admin's. Only "super_admin" can touch anyone.
 */
export async function toggleUserBan(formData: FormData): Promise<void> {
  const session = await verifySession();
  const userId = String(formData.get("userId") ?? "");
  const currentlyBanned = formData.get("currentlyBanned") === "true";
  if (!userId || userId === session.userId) return;

  const supabase = createAdminSupabaseClient();

  if (session.role !== "super_admin") {
    const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (target?.role !== "user") return; // a plain admin can't touch another admin/super_admin
  }

  await supabase.auth.admin.updateUserById(userId, {
    ban_duration: currentlyBanned ? "none" : PERMANENT_BAN,
  });

  revalidatePath("/admin/users");
}

/** Changing anyone's role (including granting/revoking admin) is super_admin only. */
export async function updateUserRole(formData: FormData): Promise<void> {
  const session = await verifySession();
  if (session.role !== "super_admin") return;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as ProfileRole;
  if (!userId || userId === session.userId) return;
  if (role !== "user" && role !== "admin" && role !== "super_admin") return;

  const supabase = createAdminSupabaseClient();
  await supabase.from("profiles").update({ role }).eq("id", userId);

  revalidatePath("/admin/users");
}

/** Deleting an account is super_admin only. */
export async function deleteUserAccount(userId: string): Promise<void> {
  const session = await verifySession();
  if (session.role !== "super_admin") throw new Error("Only a super admin can delete accounts");
  if (!userId || userId === session.userId) throw new Error("Cannot delete your own account");

  const supabase = createAdminSupabaseClient();
  await supabase.auth.admin.deleteUser(userId);

  revalidatePath("/admin/users");
}
