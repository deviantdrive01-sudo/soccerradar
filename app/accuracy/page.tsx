import { createSupabaseReadClient } from "@/lib/supabase/client";
import { accuracyPct, computeAccuracy, type MarketAccuracy } from "@/lib/accuracy";
import { LeagueAccuracyTable } from "@/components/league-accuracy-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const revalidate = 300;

function pctClass(pct: number, known: number): string {
  if (known === 0) return "border-border/60 text-muted-foreground";
  if (pct >= 60) return "border-emerald-500/30 text-emerald-400";
  if (pct >= 45) return "border-amber-500/30 text-amber-400";
  return "border-red-500/30 text-red-400";
}

function MarketAccuracyTile({ market }: { market: MarketAccuracy }) {
  const pct = accuracyPct(market.correct, market.known);
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{market.label}</div>
        <div className="text-xs text-muted-foreground">
          {market.correct}/{market.known} correct
        </div>
      </div>
      <Badge variant="outline" className={cn("text-base font-semibold", pctClass(pct, market.known))}>
        {market.known ? `${pct}%` : "–"}
      </Badge>
    </div>
  );
}

export default async function AccuracyPage() {
  const supabase = createSupabaseReadClient();

  const [{ data: predictions, error: predictionsError }, { data: leagues, error: leaguesError }] =
    await Promise.all([
      supabase
        .from("predictions")
        .select("*")
        .not("actual_result", "is", null)
        .order("match_date", { ascending: false }),
      supabase.from("leagues").select("*"),
    ]);

  if (predictionsError || leaguesError) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center text-sm text-destructive">
        Failed to load accuracy data: {predictionsError?.message ?? leaguesError?.message}
      </main>
    );
  }

  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));
  const overall = computeAccuracy(predictions ?? []);
  const overallPctValue = accuracyPct(overall.overallCorrect, overall.overallKnown);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Track Record</h1>
        <p className="text-sm text-muted-foreground">
          {overall.totalSettled} settled match{overall.totalSettled === 1 ? "" : "es"}
          {overall.totalSettled > 0 && ` · ${overallPctValue}% overall accuracy`}
        </p>
      </div>

      {overall.totalSettled === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No settled results yet — this fills in once match results are recorded against predictions.
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">By market</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overall.perMarket.map((market) => (
                <MarketAccuracyTile key={market.key} market={market} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">By league</h2>
            <p className="text-xs text-muted-foreground">
              Click a league to see the individual matches and how each prediction landed — filter by date to narrow it down.
            </p>
            <LeagueAccuracyTable predictions={predictions ?? []} leagueById={leagueById} />
          </section>
        </>
      )}
    </main>
  );
}
