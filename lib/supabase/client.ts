import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Public client — anon key, respects RLS (read-only for this app).
 * Safe to use from Server Components or the browser.
 */
export function createSupabaseReadClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
