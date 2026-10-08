/**
 * Prints a side-by-side per-market accuracy table: Claude's live
 * predictions vs. the shadow stat-only engine (lib/stat-engine.ts),
 * graded against the same real settled results. Reuses lib/accuracy.ts's
 * computeAccuracy/isMarketCorrect unchanged — both engines' output is
 * plain HydratedMarkets, so no new grading logic is needed.
 *
 * Console-only, manual/ad-hoc — this is a validation tool for the shadow
 * engine, not a UI feature.
 */
import { createClient } from "@supabase/supabase-js";
import { MARKET_KEYS, MARKET_LABELS, isMarketCorrect, type HydratedMarkets, type ActualMarkets } from "../lib/hydrate";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function tally(pairs: { predicted: HydratedMarkets; actual: ActualMarkets }[]) {
  return MARKET_KEYS.map((key) => {
    let correct = 0;
    let known = 0;
    for (const { predicted, actual } of pairs) {
      const result = isMarketCorrect(predicted, actual, key);
      if (result !== null) {
        known++;
        if (result) correct++;
      }
    }
    return { key, label: MARKET_LABELS[key], correct, known };
  });
}

async function main() {
  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("id, markets, actual_result")
    .not("actual_result", "is", null)
    .not("markets", "is", null);

  if (error) {
    console.error("Failed to load predictions:", error.message);
    process.exit(1);
  }

  const { data: statPredictions, error: statError } = await supabase.from("stat_predictions").select("prediction_id, markets");

  if (statError) {
    console.error("Failed to load stat_predictions:", statError.message);
    process.exit(1);
  }

  const statByPredictionId = new Map(statPredictions.map((s) => [s.prediction_id, s.markets as HydratedMarkets]));

  const claudePairs: { predicted: HydratedMarkets; actual: ActualMarkets }[] = [];
  const statPairs: { predicted: HydratedMarkets; actual: ActualMarkets }[] = [];

  for (const p of predictions) {
    const actual = p.actual_result.markets as ActualMarkets;
    claudePairs.push({ predicted: p.markets as HydratedMarkets, actual });
    const statMarkets = statByPredictionId.get(p.id);
    if (statMarkets) statPairs.push({ predicted: statMarkets, actual });
  }

  const claudeTally = tally(claudePairs);
  const statTally = tally(statPairs);

  console.log(`\nSettled fixtures graded — Claude: ${claudePairs.length}, Stat engine: ${statPairs.length} (only fixtures with a stat prediction already computed)\n`);
  console.log(
    `${"Market".padEnd(22)}${"Claude".padStart(14)}${"Stat engine".padStart(16)}`,
  );
  console.log("-".repeat(52));
  for (let i = 0; i < MARKET_KEYS.length; i++) {
    const c = claudeTally[i];
    const s = statTally[i];
    const cStr = c.known > 0 ? `${c.correct}/${c.known} (${Math.round((c.correct / c.known) * 100)}%)` : "-";
    const sStr = s.known > 0 ? `${s.correct}/${s.known} (${Math.round((s.correct / s.known) * 100)}%)` : "-";
    console.log(`${c.label.padEnd(22)}${cStr.padStart(14)}${sStr.padStart(16)}`);
  }

  const claudeOverall = claudeTally.reduce((acc, m) => ({ correct: acc.correct + m.correct, known: acc.known + m.known }), { correct: 0, known: 0 });
  const statOverall = statTally.reduce((acc, m) => ({ correct: acc.correct + m.correct, known: acc.known + m.known }), { correct: 0, known: 0 });
  console.log("-".repeat(52));
  console.log(
    `${"Overall".padEnd(22)}${`${claudeOverall.correct}/${claudeOverall.known}`.padStart(14)}${`${statOverall.correct}/${statOverall.known}`.padStart(16)}`,
  );
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
