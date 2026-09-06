import Link from "next/link";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { PredictionDashboard } from "@/components/prediction-dashboard";
import { ProductTour } from "@/components/product-tour";
import { SITE_TAGLINE } from "@/lib/site";

export const revalidate = 300;

const HISTORY_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

/** Impure by nature (reads the clock) — kept out of the component body so it isn't flagged as a render-purity violation. */
function historyCutoffIso(): string {
  return new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
}

export default async function Home() {
  const supabase = createSupabaseReadClient();

  // Rolling 7-day window: a full day's predictions and recorded results stay
  // browsable via the date tabs well past the day itself, without the query
  // (and page payload) growing unbounded forever.
  const [{ data: leagues, error: leaguesError }, { data: predictions, error: predictionsError }] =
    await Promise.all([
      supabase.from("leagues").select("*").eq("is_active", true).order("name"),
      supabase
        .from("predictions")
        .select("*")
        .gte("match_date", historyCutoffIso())
        .order("match_date", { ascending: true }),
    ]);

  if (leaguesError || predictionsError) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center text-sm text-destructive">
        Failed to load predictions: {leaguesError?.message ?? predictionsError?.message}
      </main>
    );
  }

  const leagueCount = leagues?.length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <p className="text-sm text-muted-foreground">
        {SITE_TAGLINE} AI-generated predictions across {leagueCount} top global leagues, updated daily —{" "}
        <Link href="/accuracy" className="font-medium text-foreground underline underline-offset-2 hover:no-underline">
          see our full track record
        </Link>
        .
      </p>

      <PredictionDashboard leagues={leagues ?? []} predictions={predictions ?? []} />
      <ProductTour />
    </main>
  );
}
