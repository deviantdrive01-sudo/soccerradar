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
  h2: OutcomeCode; // second-half-only outcome (goals scored in the 2nd half only)
  sh: ScoringHalfCode;
  g: [0 | 1, 0 | 1]; // [over_1_5, over_2_5]
  c: [0 | 1, 0 | 1, 0 | 1]; // [over_7_5, over_8_5, ht_over_3_5]
  conf: number; // 1-100
  sum: string;
}

export interface HydratedMarkets {
  outcome: { code: OutcomeCode; label: string };
  firstHalfOutcome: { code: OutcomeCode; label: string };
  /** Optional: absent on predictions generated before this market existed. */
  secondHalfOutcome?: { code: OutcomeCode; label: string };
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
    secondHalfOutcome: hydrateOutcome(compact.h2),
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

/** Full-time draw — derived from the same underlying full-time pick, so it can never disagree with it. */
export function isFullTimeDraw(markets: HydratedMarkets): boolean {
  return markets.outcome.code === "X";
}

/**
 * "Win either half" — did this side win at least one of the two halves
 * outright (by goals scored in that half only)? Requires the second-half
 * pick, so it's null (unknown) on predictions generated before that market
 * existed rather than silently wrong.
 */
function homeWinsEitherHalf(markets: HydratedMarkets): boolean | null {
  if (!markets.secondHalfOutcome) return null;
  return markets.firstHalfOutcome.code === "1" || markets.secondHalfOutcome.code === "1";
}

function awayWinsEitherHalf(markets: HydratedMarkets): boolean | null {
  if (!markets.secondHalfOutcome) return null;
  return markets.firstHalfOutcome.code === "2" || markets.secondHalfOutcome.code === "2";
}

export type WinEitherHalfCode = "1" | "2";

/**
 * Collapses the two independent "did this side win a half" booleans into a
 * single pick, since split results (each side wins one half) or two drawn
 * halves are rare and a single "1 or 2" pick reads much simpler in the UI.
 * Ties break on the full-time result, then the half-time result, then
 * default home — in that order of how correlated each is with which side
 * was the more dominant.
 */
function resolveEitherHalfCode(home: boolean, away: boolean, ftCode: OutcomeCode, htCode: OutcomeCode): WinEitherHalfCode {
  if (home && !away) return "1";
  if (away && !home) return "2";
  if (ftCode !== "X") return ftCode;
  if (htCode !== "X") return htCode;
  return "1";
}

/** Null (unknown) on predictions generated before the second-half pick existed. */
export function winEitherHalfCode(markets: HydratedMarkets): WinEitherHalfCode | null {
  const home = homeWinsEitherHalf(markets);
  const away = awayWinsEitherHalf(markets);
  if (home === null || away === null) return null;
  return resolveEitherHalfCode(home, away, markets.outcome.code, markets.firstHalfOutcome.code);
}

/**
 * Actual result recording — filled in manually after full time, since there's
 * no live-score feed wired up yet. Only the raw scoreline and corner counts
 * are entered; every per-market actual (outcome, over lines, etc.) is derived
 * from those so it's always consistent with how predictions are computed.
 */
export interface RawMatchResult {
  finalScore: { home: number; away: number };
  htScore: { home: number; away: number };
  corners: { home: number; away: number };
  /** Not every source reports first-half corners — omit when unknown. */
  htCorners?: { home: number; away: number } | null;
}

export interface ActualMarkets {
  outcome: { code: OutcomeCode; label: string };
  firstHalfOutcome: { code: OutcomeCode; label: string };
  secondHalfOutcome: { code: OutcomeCode; label: string };
  highestScoringHalf: { code: ScoringHalfCode; label: string };
  goals: {
    over1_5: boolean;
    over2_5: boolean;
  };
  corners: {
    over7_5: boolean;
    over8_5: boolean;
    /** null when first-half corner counts weren't available for this match. */
    firstHalfOver3_5: boolean | null;
  };
}

export interface ActualResult {
  raw: RawMatchResult;
  markets: ActualMarkets;
}

function outcomeFromScore(home: number, away: number): OutcomeCode {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

export function deriveActualResult(raw: RawMatchResult): ActualResult {
  const totalGoals = raw.finalScore.home + raw.finalScore.away;
  const htGoals = raw.htScore.home + raw.htScore.away;
  const secondHalfGoals = totalGoals - htGoals;
  const highestScoringHalf: ScoringHalfCode =
    htGoals > secondHalfGoals ? "1st" : htGoals < secondHalfGoals ? "2nd" : "Equal";
  const secondHalfScore = {
    home: raw.finalScore.home - raw.htScore.home,
    away: raw.finalScore.away - raw.htScore.away,
  };

  const totalCorners = raw.corners.home + raw.corners.away;
  const htCornersTotal = raw.htCorners ? raw.htCorners.home + raw.htCorners.away : null;

  return {
    raw,
    markets: {
      outcome: hydrateOutcome(outcomeFromScore(raw.finalScore.home, raw.finalScore.away)),
      firstHalfOutcome: hydrateOutcome(outcomeFromScore(raw.htScore.home, raw.htScore.away)),
      secondHalfOutcome: hydrateOutcome(outcomeFromScore(secondHalfScore.home, secondHalfScore.away)),
      highestScoringHalf: hydrateScoringHalf(highestScoringHalf),
      goals: {
        over1_5: totalGoals > 1.5,
        over2_5: totalGoals > 2.5,
      },
      corners: {
        over7_5: totalCorners > 7.5,
        over8_5: totalCorners > 8.5,
        firstHalfOver3_5: htCornersTotal === null ? null : htCornersTotal > 3.5,
      },
    },
  };
}

export function isActualDrawOrOver2_5(actual: ActualMarkets): boolean {
  return actual.outcome.code === "X" || actual.goals.over2_5;
}

export function isActualFullTimeDraw(actual: ActualMarkets): boolean {
  return actual.outcome.code === "X";
}

function isActualHomeWinsEitherHalf(actual: ActualMarkets): boolean {
  return actual.firstHalfOutcome.code === "1" || actual.secondHalfOutcome.code === "1";
}

function isActualAwayWinsEitherHalf(actual: ActualMarkets): boolean {
  return actual.firstHalfOutcome.code === "2" || actual.secondHalfOutcome.code === "2";
}

export function actualWinEitherHalfCode(actual: ActualMarkets): WinEitherHalfCode {
  const home = isActualHomeWinsEitherHalf(actual);
  const away = isActualAwayWinsEitherHalf(actual);
  return resolveEitherHalfCode(home, away, actual.outcome.code, actual.firstHalfOutcome.code);
}

export type MarketKey =
  | "fullTimeDraw"
  | "firstHalfOutcome"
  | "winEitherHalf"
  | "highestScoringHalf"
  | "over1_5"
  | "over2_5"
  | "drawOrOver2_5"
  | "over7_5"
  | "over8_5"
  | "firstHalfOver3_5";

export const MARKET_KEYS: MarketKey[] = [
  "fullTimeDraw",
  "firstHalfOutcome",
  "winEitherHalf",
  "highestScoringHalf",
  "over1_5",
  "over2_5",
  "drawOrOver2_5",
  "over7_5",
  "over8_5",
  "firstHalfOver3_5",
];

export const MARKET_LABELS: Record<MarketKey, string> = {
  fullTimeDraw: "FT Draw",
  firstHalfOutcome: "1H Outcome",
  winEitherHalf: "Win Either Half",
  highestScoringHalf: "Highest Half",
  over1_5: "Over 1.5",
  over2_5: "Over 2.5",
  drawOrOver2_5: "Draw/O2.5",
  over7_5: "Corners O7.5",
  over8_5: "Corners O8.5",
  firstHalfOver3_5: "1H Corners O3.5",
};

/** Was this one market's prediction right? null when the actual or predicted value isn't known. */
export function isMarketCorrect(
  predicted: HydratedMarkets,
  actual: ActualMarkets,
  key: MarketKey,
): boolean | null {
  switch (key) {
    case "fullTimeDraw":
      return isFullTimeDraw(predicted) === isActualFullTimeDraw(actual);
    case "firstHalfOutcome":
      return predicted.firstHalfOutcome.code === actual.firstHalfOutcome.code;
    case "winEitherHalf": {
      const p = winEitherHalfCode(predicted);
      return p === null ? null : p === actualWinEitherHalfCode(actual);
    }
    case "highestScoringHalf":
      return predicted.highestScoringHalf.code === actual.highestScoringHalf.code;
    case "over1_5":
      return predicted.goals.over1_5 === actual.goals.over1_5;
    case "over2_5":
      return predicted.goals.over2_5 === actual.goals.over2_5;
    case "drawOrOver2_5":
      return isDrawOrOver2_5(predicted) === isActualDrawOrOver2_5(actual);
    case "over7_5":
      return predicted.corners.over7_5 === actual.corners.over7_5;
    case "over8_5":
      return predicted.corners.over8_5 === actual.corners.over8_5;
    case "firstHalfOver3_5":
      return actual.corners.firstHalfOver3_5 === null
        ? null
        : predicted.corners.firstHalfOver3_5 === actual.corners.firstHalfOver3_5;
  }
}

/**
 * What was actually predicted for this market, as a short display string —
 * e.g. "Yes"/"No" for boolean markets, or the outcome/half label for
 * categorical ones. Settled-match UI must show this alongside a correct/
 * incorrect indicator: a bare checkmark next to "FT Draw" or "Corners O7.5"
 * reads as "this happened", when it actually means "the call was right" —
 * those are different claims once the prediction and the actual result can
 * disagree.
 */
export function marketPredictionLabel(predicted: HydratedMarkets, key: MarketKey): string {
  switch (key) {
    case "fullTimeDraw":
      return isFullTimeDraw(predicted) ? "Yes" : "No";
    case "firstHalfOutcome":
      return predicted.firstHalfOutcome.label;
    case "winEitherHalf": {
      const v = winEitherHalfCode(predicted);
      return v === null ? "–" : v === "1" ? "Home" : "Away";
    }
    case "highestScoringHalf":
      return predicted.highestScoringHalf.label;
    case "over1_5":
      return predicted.goals.over1_5 ? "Yes" : "No";
    case "over2_5":
      return predicted.goals.over2_5 ? "Yes" : "No";
    case "drawOrOver2_5":
      return isDrawOrOver2_5(predicted) ? "Yes" : "No";
    case "over7_5":
      return predicted.corners.over7_5 ? "Yes" : "No";
    case "over8_5":
      return predicted.corners.over8_5 ? "Yes" : "No";
    case "firstHalfOver3_5":
      return predicted.corners.firstHalfOver3_5 ? "Yes" : "No";
  }
}

export function isCompactPrediction(value: unknown): value is CompactPrediction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    (v.o === "1" || v.o === "X" || v.o === "2") &&
    (v.ht === "1" || v.ht === "X" || v.ht === "2") &&
    (v.h2 === "1" || v.h2 === "X" || v.h2 === "2") &&
    (v.sh === "1st" || v.sh === "2nd" || v.sh === "Equal") &&
    Array.isArray(v.g) &&
    v.g.length === 2 &&
    Array.isArray(v.c) &&
    v.c.length === 3 &&
    typeof v.conf === "number" &&
    typeof v.sum === "string"
  );
}

export interface SettledMarketResult {
  key: MarketKey;
  label: string;
  /** What was predicted, as a short display string (e.g. "Yes", "Draw"). */
  value: string;
  correct: boolean | null;
}

/** One row per tracked market, pairing the predicted value with whether it landed. */
export function summarizeSettledMarkets(predicted: HydratedMarkets, actual: ActualMarkets): SettledMarketResult[] {
  return MARKET_KEYS.map((key) => ({
    key,
    label: MARKET_LABELS[key],
    value: marketPredictionLabel(predicted, key),
    correct: isMarketCorrect(predicted, actual, key),
  }));
}

export function settledMarketTally(results: SettledMarketResult[]): { known: number; correct: number } {
  const known = results.filter((r) => r.correct !== null);
  return { known: known.length, correct: known.filter((r) => r.correct).length };
}
