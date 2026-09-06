import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/supabase/types";

/**
 * Requires a session AND profiles.role of "admin" or "super_admin" — public
 * sign-up now exists, so being logged in is no longer sufficient (see
 * supabase/migrations/03_accounts.sql, 07_admin_roles.sql). Redirects to the
 * admin login page otherwise.
 */
export const verifySession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    redirect("/admin/login");
  }

  return { userId: user.id, email: user.email ?? null, role: profile.role as ProfileRole };
});
