import { isMarketCorrect, type MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

/**
 * Pairs one booking pick with whether it landed, once its match is settled.
 * `correct: null` means the underlying prediction has no actual_result yet —
 * distinct from `false`, which means it settled and this specific pick lost.
 */
export interface GradedPick {
  prediction: Prediction;
  marketKey: MarketKey;
  correct: boolean | null;
}

export function gradePicks(
  picks: { prediction: Prediction; marketKey: MarketKey }[],
): GradedPick[] {
  return picks.map(({ prediction, marketKey }) => ({
    prediction,
    marketKey,
    correct:
      prediction.actual_result && prediction.markets
        ? isMarketCorrect(prediction.markets, prediction.actual_result.markets, marketKey)
        : null,
  }));
}

export function tallyGraded(graded: GradedPick[]): { settled: number; correct: number } {
  const settled = graded.filter((g) => g.correct !== null);
  return { settled: settled.length, correct: settled.filter((g) => g.correct).length };
}
