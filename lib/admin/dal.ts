import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Single-admin app — any authenticated Supabase user is "the admin" (there's
 * no signup flow, so the only account that can ever exist is the one created
 * for this purpose). Redirects to the login page if there's no session.
 */
export const verifySession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return { userId: user.id, email: user.email ?? null };
});
