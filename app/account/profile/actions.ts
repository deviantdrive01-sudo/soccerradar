"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProfileActionState {
  error?: string;
  success?: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export async function updateProfile(
  _prevState: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const username = String(formData.get("username") ?? "").trim();
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Username must be 3-20 characters: letters, numbers, or underscores." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
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

  let avatarUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return { error: "Photo must be an image file." };
    }
    if (photo.size > MAX_AVATAR_BYTES) {
      return { error: "Photo must be under 2MB." };
    }
    const ext = photo.type.split("/")[1] || "jpg";
    const path = `${user.userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, photo, {
      upsert: true,
      contentType: photo.type,
    });
    if (uploadError) return { error: `Could not upload photo: ${uploadError.message}` };

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust so the new photo shows immediately even though the path is stable.
    avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ username, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) })
    .eq("id", user.userId);
  if (profileError) return { error: "Could not update profile." };

  let emailChanged = false;
  if (email !== user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email });
    if (emailError) return { error: `Could not update email: ${emailError.message}` };
    emailChanged = true;
  }

  revalidatePath("/account/profile");
  revalidatePath("/account");
  return {
    success: emailChanged
      ? "Profile updated. Check your new email address to confirm the change."
      : "Profile updated.",
  };
}

export async function updatePasswordSecure(
  _prevState: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user || !user.email) return { error: "Not signed in." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return { error: "Enter your current password." };
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "New password and confirmation don't match." };

  const supabase = await createSupabaseServerClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: "Could not update password." };

  return { success: "Password updated." };
}

export async function signOutOtherSessions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: ProfileActionState | undefined,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: "Could not log out other sessions." };

  return { success: "Logged out of all other browser sessions." };
}
