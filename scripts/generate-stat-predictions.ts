/**
 * Computes the stat-only engine's output (lib/stat-engine.ts — pure
 * computation, no network calls) for every prediction row that has
 * `api_football_context` stored (attached at crawl time, see
 * scripts/crawl-fixtures.ts) but no stat prediction yet, and:
 *   1. always writes it to `stat_predictions` (comparison/audit trail,
 *      see scripts/compare-engines.ts), and
 *   2. ALSO writes it into `predictions.markets`/`confidence`/`summary`
 *      when that row's `markets` is still null — i.e. this is now the live
 *      engine for any fixture that didn't already get a Claude prediction.
 *      Rows that already have a (published, possibly already-graded)
 *      Claude prediction are never touched.
 */
import { createClient } from "@supabase/supabase-js";
import { computeStatPrediction, statEngineSummary } from "../lib/stat-engine";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // Re-run everyone when FORCE=1 (e.g. after a stat-engine code change) —
  // otherwise only fixtures without a stat prediction yet.
  const force = process.env.FORCE === "1";

  const { data: rows, error } = await supabase
    .from("predictions")
    .select("id, home_team, away_team, markets, api_football_context")
    .not("api_football_context", "is", null);

  if (error) {
    console.error("Failed to load predictions:", error.message);
    process.exit(1);
  }

  let targetRows = rows;
  if (!force) {
    const { data: existing } = await supabase.from("stat_predictions").select("prediction_id");
    const already = new Set((existing ?? []).map((r) => r.prediction_id));
    targetRows = rows.filter((r) => !already.has(r.id));
  }

  console.log(`Computing stat predictions for ${targetRows.length} fixture(s)${force ? " (forced re-run)" : ""}...`);

  let computed = 0;
  let skipped = 0;
  let liveFilled = 0;
  const shadowWrites: { prediction_id: number; markets: unknown; confidence: number; inputs: unknown }[] = [];
  const liveUpdates: { id: number; markets: unknown; confidence: number; summary: string }[] = [];

  for (const row of targetRows) {
    const result = computeStatPrediction(row.api_football_context);
    if (!result) {
      skipped++;
      continue;
    }
    shadowWrites.push({
      prediction_id: row.id,
      markets: result.markets,
      confidence: result.confidence,
      inputs: result.inputs,
    });
    computed++;

    if (row.markets === null) {
      liveUpdates.push({
        id: row.id,
        markets: result.markets,
        confidence: result.confidence,
        summary: statEngineSummary(result, row.home_team, row.away_team),
      });
      liveFilled++;
    }
  }

  if (shadowWrites.length > 0) {
    const { error: upsertError } = await supabase.from("stat_predictions").upsert(shadowWrites, { onConflict: "prediction_id" });
    if (upsertError) {
      console.error("Failed to write stat predictions:", upsertError.message);
      process.exit(1);
    }
  }

  for (const update of liveUpdates) {
    const { error: liveError } = await supabase
      .from("predictions")
      .update({ markets: update.markets, confidence: update.confidence, summary: update.summary })
      .eq("id", update.id)
      .is("markets", null); // belt-and-suspenders: never overwrite a prediction that landed between our read and this write
    if (liveError) {
      console.error(`Failed to write live prediction for id ${update.id}:`, liveError.message);
    }
  }

  console.log("\n=== Generate-stat-predictions summary ===");
  console.log(`Computed & written to stat_predictions: ${computed}`);
  console.log(`Also filled in predictions.markets (was null): ${liveFilled}`);
  console.log(`Skipped (missing goalsForAvg/goalsAgainstAvg): ${skipped}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
