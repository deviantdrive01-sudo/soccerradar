/**
 * Populates `stat_predictions` — the shadow, stat-only engine's output —
 * for every prediction row that already has `api_football_context` stored
 * (attached at crawl time now, see scripts/crawl-fixtures.ts) but doesn't
 * have a stat prediction yet. Pure computation, no network calls: see
 * lib/stat-engine.ts for the actual Poisson math.
 *
 * Manual/ad-hoc only for now (not wired into a GitHub Actions workflow) —
 * this is a shadow engine being validated against Claude via
 * scripts/compare-engines.ts, not live infrastructure yet.
 */
import { createClient } from "@supabase/supabase-js";
import { computeStatPrediction } from "../lib/stat-engine";

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
    .select("id, home_team, away_team, api_football_context")
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
  const writes: { prediction_id: number; markets: unknown; confidence: number; inputs: unknown }[] = [];

  for (const row of targetRows) {
    const result = computeStatPrediction(row.api_football_context);
    if (!result) {
      skipped++;
      continue;
    }
    writes.push({
      prediction_id: row.id,
      markets: result.markets,
      confidence: result.confidence,
      inputs: result.inputs,
    });
    computed++;
  }

  if (writes.length > 0) {
    const { error: upsertError } = await supabase.from("stat_predictions").upsert(writes, { onConflict: "prediction_id" });
    if (upsertError) {
      console.error("Failed to write stat predictions:", upsertError.message);
      process.exit(1);
    }
  }

  console.log("\n=== Generate-stat-predictions summary ===");
  console.log(`Computed & written: ${computed}`);
  console.log(`Skipped (missing goalsForAvg/goalsAgainstAvg): ${skipped}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
