"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  success?: boolean;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function login(_prevState: AuthState | undefined, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  return { success: true };
}

export async function signup(_prevState: AuthState | undefined, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();

  if (!email || !password || !username) {
    return { error: "Email, password, and username are required." };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Username must be 3-20 characters: letters, numbers, or underscores." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) {
    return { error: "That username is already taken." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    return { error: error.message.includes("already registered") ? "That email is already registered." : "Could not create your account." };
  }

  return { success: true };
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
