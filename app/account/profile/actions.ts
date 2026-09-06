"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProfileActionState {
  error?: string;
  success?: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function updateUsername(
  _prevState: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const username = String(formData.get("username") ?? "").trim();
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Username must be 3-20 characters: letters, numbers, or underscores." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.userId)
    .maybeSingle();
  if (existing) {
    return { error: "That username is already taken." };
  }

  const { error } = await supabase.from("profiles").update({ username }).eq("id", user.userId);
  if (error) return { error: "Could not update username." };

  revalidatePath("/account/profile");
  revalidatePath("/account");
  return { success: "Username updated." };
}

export async function updatePassword(
  _prevState: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not update password." };

  return { success: "Password updated." };
}
