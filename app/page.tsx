import { createSupabaseReadClient } from "@/lib/supabase/client";
import { PredictionDashboard } from "@/components/prediction-dashboard";

export const revalidate = 300;

const RECENT_WINDOW_MS = 1000 * 60 * 60 * 6;

/** Impure by nature (reads the clock) — kept out of the component body so it isn't flagged as a render-purity violation. */
function recentCutoffIso(): string {
  return new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
}

export default async function Home() {
  const supabase = createSupabaseReadClient();

  const [{ data: leagues, error: leaguesError }, { data: predictions, error: predictionsError }] =
    await Promise.all([
      supabase.from("leagues").select("*").eq("is_active", true).order("name"),
      supabase
        .from("predictions")
        .select("*")
        .gte("match_date", recentCutoffIso())
        .order("match_date", { ascending: true }),
    ]);

  if (leaguesError || predictionsError) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center text-sm text-destructive">
        Failed to load predictions: {leaguesError?.message ?? predictionsError?.message}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">SoccerRadar</h1>
        <p className="text-sm text-muted-foreground">
          AI-generated predictions across 16 top global leagues, updated weekly.
        </p>
      </header>

      <PredictionDashboard leagues={leagues ?? []} predictions={predictions ?? []} />
    </main>
  );
}
