import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateLeague, createLeague } from "./actions";

const FIELD = "h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function AdminLeaguesPage() {
  const supabase = createAdminSupabaseClient();
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("*")
    .order("country", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return <p className="text-sm text-destructive">Failed to load leagues: {error.message}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leagues</h1>
        <p className="text-sm text-muted-foreground">
          Edit league details and Flashscore links. Each row saves independently.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-2 font-medium">Name</th>
              <th className="p-2 font-medium">Country</th>
              <th className="p-2 font-medium">API league ID</th>
              <th className="p-2 font-medium">Flashscore slug</th>
              <th className="p-2 font-medium text-center">Active</th>
              <th className="p-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(leagues ?? []).map((league) => (
              <tr key={league.id} className="border-b border-border/60 last:border-0">
                <td colSpan={6} className="p-0">
                  <form action={updateLeague} className="grid grid-cols-[1fr_1fr_140px_1fr_70px_80px] items-center gap-2 p-2">
                    <input type="hidden" name="id" value={league.id} />
                    <input name="name" defaultValue={league.name} className={FIELD} />
                    <input name="country" defaultValue={league.country} className={FIELD} />
                    <span className="px-2 text-muted-foreground">{league.api_league_id}</span>
                    <input
                      name="flashscore_slug"
                      defaultValue={league.flashscore_slug ?? ""}
                      placeholder="e.g. germany/bundesliga"
                      className={FIELD}
                    />
                    <label className="flex items-center justify-center gap-1.5">
                      <input type="checkbox" name="is_active" defaultChecked={league.is_active} className="size-4" />
                    </label>
                    <button
                      type="submit"
                      className="h-8 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                    >
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-md border border-border/60 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add a league</h2>
        <form action={createLeague} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input name="name" placeholder="Name" required className={FIELD} />
          <input name="country" placeholder="Country" required className={FIELD} />
          <input
            name="api_league_id"
            type="number"
            placeholder="API league ID (use 900xxx if none)"
            required
            className={FIELD}
          />
          <input name="flashscore_slug" placeholder="Flashscore slug (optional)" className={FIELD} />
          <button
            type="submit"
            className="h-8 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add league
          </button>
        </form>
      </div>
    </div>
  );
}
