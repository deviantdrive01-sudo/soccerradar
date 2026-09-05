/**
 * Hydration engine.
 *
 * Claude is instructed to respond in a compact shorthand JSON format to
 * minimize completion tokens (see lib/prediction-engine.ts). This module
 * turns that shorthand into a fully labeled shape safe to store in
 * Supabase and render directly in the UI, so no other part of the app
 * needs to know the shorthand keys exist.
 */

export type OutcomeCode = "1" | "X" | "2";
export type ScoringHalfCode = "1st" | "2nd" | "Equal";

/** Exact shape Claude must return, per match, in the compact response. */
export interface CompactPrediction {
  id: number; // match_id, echoed back by the model for reconciliation
  o: OutcomeCode;
  ht: OutcomeCode;
  sh: ScoringHalfCode;
  g: [0 | 1, 0 | 1]; // [over_1_5, over_2_5]
  c: [0 | 1, 0 | 1, 0 | 1]; // [over_7_5, over_8_5, ht_over_3_5]
  conf: number; // 1-100
  sum: string;
}

export interface HydratedMarkets {
  outcome: { code: OutcomeCode; label: string };
  firstHalfOutcome: { code: OutcomeCode; label: string };
  highestScoringHalf: { code: ScoringHalfCode; label: string };
  goals: {
    over1_5: boolean;
    over2_5: boolean;
  };
  corners: {
    over7_5: boolean;
    over8_5: boolean;
    firstHalfOver3_5: boolean;
  };
}

export interface HydratedPrediction {
  matchId: number;
  markets: HydratedMarkets;
  confidence: number;
  summary: string;
}

const OUTCOME_LABELS: Record<OutcomeCode, string> = {
  "1": "Home Win",
  X: "Draw",
  "2": "Away Win",
};

const SCORING_HALF_LABELS: Record<ScoringHalfCode, string> = {
  "1st": "First Half",
  "2nd": "Second Half",
  Equal: "Evenly Split",
};

function hydrateOutcome(code: OutcomeCode) {
  return { code, label: OUTCOME_LABELS[code] };
}

function hydrateScoringHalf(code: ScoringHalfCode) {
  return { code, label: SCORING_HALF_LABELS[code] };
}

export function hydrateMarkets(compact: CompactPrediction): HydratedMarkets {
  return {
    outcome: hydrateOutcome(compact.o),
    firstHalfOutcome: hydrateOutcome(compact.ht),
    highestScoringHalf: hydrateScoringHalf(compact.sh),
    goals: {
      over1_5: compact.g[0] === 1,
      over2_5: compact.g[1] === 1,
    },
    corners: {
      over7_5: compact.c[0] === 1,
      over8_5: compact.c[1] === 1,
      firstHalfOver3_5: compact.c[2] === 1,
    },
  };
}

export function hydratePrediction(compact: CompactPrediction): HydratedPrediction {
  return {
    matchId: compact.id,
    markets: hydrateMarkets(compact),
    confidence: compact.conf,
    summary: compact.sum,
  };
}

/**
 * "Draw or Over 2.5" combo market — true if the match is predicted to be a
 * draw OR to have over 2.5 total goals. Derived from the two underlying
 * predictions rather than asked of Claude directly, so it costs no extra
 * tokens and works on predictions generated before this market existed.
 */
export function isDrawOrOver2_5(markets: HydratedMarkets): boolean {
  return markets.outcome.code === "X" || markets.goals.over2_5;
}

export function isCompactPrediction(value: unknown): value is CompactPrediction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    (v.o === "1" || v.o === "X" || v.o === "2") &&
    (v.ht === "1" || v.ht === "X" || v.ht === "2") &&
    (v.sh === "1st" || v.sh === "2nd" || v.sh === "Equal") &&
    Array.isArray(v.g) &&
    v.g.length === 2 &&
    Array.isArray(v.c) &&
    v.c.length === 3 &&
    typeof v.conf === "number" &&
    typeof v.sum === "string"
  );
}
