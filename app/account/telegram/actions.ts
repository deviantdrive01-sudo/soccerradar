"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easier to type from a phone screen
const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export interface LinkCodeState {
  error?: string;
  code?: string;
}

export async function generateLinkCode(): Promise<LinkCodeState> {
  // Session client only to authenticate the caller — the actual write goes
  // through the admin client (see the migration's RLS comment for why).
  const session = await createSupabaseServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) redirect("/login");

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("telegram_links")
    .upsert({ user_id: user.id, link_code: code, code_expires_at: expiresAt }, { onConflict: "user_id" });

  if (error) return { error: "Could not generate a linking code — please try again." };

  revalidatePath("/account/telegram");
  return { code };
}

export async function unlinkTelegram(): Promise<void> {
  const session = await createSupabaseServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabaseClient();
  await admin
    .from("telegram_links")
    .update({ chat_id: null, linked_at: null, link_code: null, code_expires_at: null })
    .eq("user_id", user.id);

  revalidatePath("/account/telegram");
}
