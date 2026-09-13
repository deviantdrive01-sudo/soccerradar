import { Fragment } from "react";
import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { League } from "@/lib/supabase/types";
import { updateLeague, createLeague } from "./actions";

const FIELD = "h-7 w-full rounded-md border border-border/60 bg-background px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function groupByCountry(leagues: League[]): [string, League[]][] {
  const groups = new Map<string, League[]>();
  for (const league of leagues) {
    const existing = groups.get(league.country);
    if (existing) existing.push(league);
    else groups.set(league.country, [league]);
  }
  return [...groups.entries()];
}

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

  const grouped = groupByCountry(leagues ?? []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leagues</h1>
          <p className="text-sm text-muted-foreground">
            Edit league details and Flashscore/API-Football links. Each row saves independently.
          </p>
        </div>
        <Link
          href="/admin/leagues/browse"
          className="h-8 shrink-0 rounded-md border border-border/60 px-3 text-xs font-medium leading-8 hover:bg-muted/60"
        >
          Browse API-Football leagues →
        </Link>
      </div>

      <div className="space-y-3 rounded-md border border-border/60 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add a league</h2>
        <form action={createLeague} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input name="name" placeholder="Name" required className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          <input name="country" placeholder="Country" required className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          <input
            name="api_league_id"
            type="number"
            placeholder="API league ID (use 900xxx if none)"
            required
            className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <input name="flashscore_slug" placeholder="Flashscore slug (optional)" className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          <button
            type="submit"
            className="h-8 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add league
          </button>
        </form>
      </div>

      {/* Phone: stacked cards, grouped by country — the table below needs 900px+ to read without horizontal scrolling. */}
      <div className="space-y-5 sm:hidden">
        {grouped.map(([country, countryLeagues]) => (
          <div key={country} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{country}</h2>
            <div className="space-y-2">
              {countryLeagues.map((league) => (
                <form
                  key={league.id}
                  action={updateLeague}
                  className="space-y-2 rounded-md border border-border/60 p-3"
                >
                  <input type="hidden" name="id" value={league.id} />
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</label>
                    <input name="name" defaultValue={league.name} className={FIELD} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Country</label>
                    <input name="country" defaultValue={league.country} className={FIELD} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">API league ID</label>
                    <input name="api_league_id" type="number" defaultValue={league.api_league_id} className={FIELD} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Flashscore slug</label>
                    <input
                      name="flashscore_slug"
                      defaultValue={league.flashscore_slug ?? ""}
                      placeholder="e.g. germany/bundesliga"
                      className={FIELD}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked={league.is_active} className="size-4" />
                        Active
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name="use_api_football"
                          defaultChecked={league.use_api_football}
                          className="size-4"
                        />
                        API-Football
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="h-8 rounded-md border border-border/60 px-3 text-xs font-medium hover:bg-muted/60"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* sm+: compact table, grouped by country */}
      <div className="hidden overflow-x-auto rounded-md border border-border/60 sm:block">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-1.5 font-medium">Name</th>
              <th className="p-1.5 font-medium">Country</th>
              <th className="p-1.5 font-medium">API league ID</th>
              <th className="p-1.5 font-medium">Flashscore slug</th>
              <th className="p-1.5 font-medium text-center">Active</th>
              <th className="p-1.5 font-medium text-center">API-FB</th>
              <th className="p-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([country, countryLeagues]) => (
              <Fragment key={country}>
                <tr className="border-b border-border/60 bg-muted/40">
                  <td colSpan={7} className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {country} <span className="font-normal normal-case">({countryLeagues.length})</span>
                  </td>
                </tr>
                {countryLeagues.map((league) => (
                  <tr key={league.id} className="border-b border-border/60 last:border-0">
                    <td colSpan={7} className="p-0">
                      <form
                        action={updateLeague}
                        className="grid grid-cols-[1fr_1fr_110px_1fr_56px_56px_64px] items-center gap-1.5 px-1.5 py-1"
                      >
                        <input type="hidden" name="id" value={league.id} />
                        <input name="name" defaultValue={league.name} className={FIELD} />
                        <input name="country" defaultValue={league.country} className={FIELD} />
                        <input name="api_league_id" type="number" defaultValue={league.api_league_id} className={FIELD} />
                        <input
                          name="flashscore_slug"
                          defaultValue={league.flashscore_slug ?? ""}
                          placeholder="e.g. germany/bundesliga"
                          className={FIELD}
                        />
                        <label className="flex items-center justify-center gap-1.5">
                          <input type="checkbox" name="is_active" defaultChecked={league.is_active} className="size-3.5" />
                        </label>
                        <label className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            name="use_api_football"
                            defaultChecked={league.use_api_football}
                            className="size-3.5"
                          />
                        </label>
                        <button
                          type="submit"
                          className="h-6 rounded-md border border-border/60 px-2 text-[11px] font-medium hover:bg-muted/60"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
