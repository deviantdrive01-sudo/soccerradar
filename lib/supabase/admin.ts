import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Server-only client using the service role key — bypasses RLS.
 * Never import this from a client component or expose it to the browser.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
