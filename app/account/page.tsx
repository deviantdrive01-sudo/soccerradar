import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default async function AccountOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const [{ count: countries }, { count: leagues }, { count: matches }, { count: collections }] = await Promise.all([
    supabase.from("favorite_countries").select("*", { count: "exact", head: true }).eq("user_id", user.userId),
    supabase.from("favorite_leagues").select("*", { count: "exact", head: true }).eq("user_id", user.userId),
    supabase.from("favorite_matches").select("*", { count: "exact", head: true }).eq("user_id", user.userId),
    supabase.from("bookmark_collections").select("*", { count: "exact", head: true }).eq("user_id", user.userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.username ?? user.email}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Favorited countries" value={countries ?? 0} />
        <Tile label="Favorited leagues" value={leagues ?? 0} />
        <Tile label="Favorited matches" value={matches ?? 0} />
        <Tile label="Collections" value={collections ?? 0} />
      </div>
    </div>
  );
}
