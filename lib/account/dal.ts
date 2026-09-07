import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentUser {
  userId: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/**
 * Unlike admin's verifySession, this never redirects — most pages work for
 * logged-out visitors, only favoriting/the favorites page require a session.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
});
