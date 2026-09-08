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

/**
 * Independent confidence (1-100) per underlying primitive Claude predicts —
 * lets a user see e.g. "88% on corners, 55% on first-half outcome" for the
 * same match instead of one blanket number covering everything. Combo
 * markets (fullTimeDraw, winEitherHalf, drawOrOver2_5, doubleChance) don't
 * get their own entry here — see marketConfidence() below, which derives
 * theirs from whichever of these actually determines the combo's value, the
 * same way their predicted value is derived rather than asked of Claude
 * directly.
 */
export interface MarketConfidences {
  o: number;
  ht: number;
  h2: number;
  sh: number;
  g1: number;
  g2: number;
  c1: number;
  c3: number;
  csh: number;
  csa: number;
  tch: number; // home team corners over 4.5
  tca: number; // away team corners over 4.5
  tgh: number; // home team goals over 1.5
  tga: number; // away team goals over 1.5
  btts: number; // both teams to score
}

/** Exact shape Claude must return, per match, in the compact response. */
export interface CompactPrediction {
  id: string; // match_id, echoed back by the model for reconciliation
  o: OutcomeCode;
  ht: OutcomeCode;
  h2: OutcomeCode; // second-half-only outcome (goals scored in the 2nd half only)
  sh: ScoringHalfCode;
  g: [0 | 1, 0 | 1]; // [over_1_5, over_2_5]
  c: [0 | 1, 0 | 1, 0 | 1]; // [over_7_5, over_8_5, ht_over_3_5]
  cs: [0 | 1, 0 | 1]; // [home_clean_sheet, away_clean_sheet]
  tc: [0 | 1, 0 | 1]; // [home_corners_over_4_5, away_corners_over_4_5]
  tg: [0 | 1, 0 | 1]; // [home_goals_over_1_5, away_goals_over_1_5]
  btts: 0 | 1; // both teams to score
  mc: MarketConfidences;
  conf: number; // 1-100, overall confidence across the whole prediction set
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
  /** Optional: absent on predictions generated before this market existed. */
  cleanSheets?: {
    home: boolean;
    away: boolean;
  };
  /** Optional: absent on predictions generated before these markets existed. */
  teamCorners?: {
    home: boolean;
    away: boolean;
  };
  teamGoals?: {
    home: boolean;
    away: boolean;
  };
  bothTeamsToScore?: boolean;
  /** Optional: absent on predictions generated before per-market confidence existed. */
  confidence?: MarketConfidences;
}

export interface HydratedPrediction {
  matchId: string;
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
    cleanSheets: {
      home: compact.cs[0] === 1,
      away: compact.cs[1] === 1,
    },
    teamCorners: {
      home: compact.tc[0] === 1,
      away: compact.tc[1] === 1,
    },
    teamGoals: {
      home: compact.tg[0] === 1,
      away: compact.tg[1] === 1,
    },
    bothTeamsToScore: compact.btts === 1,
    confidence: compact.mc,
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
 * "2X & Over 1.5" combo — the model's own outcome pick isn't a home win
 * (i.e. draw or away, the "X2" double chance side) AND total goals are
 * predicted over 1.5. An AND of two independent existing predictions, same
 * derivation approach as isDrawOrOver2_5 (an OR of two), just the other
 * boolean operator.
 */
export function isX2AndOver1_5(markets: HydratedMarkets): boolean {
  return markets.outcome.code !== "1" && markets.goals.over1_5;
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
  /** Absent on results derived before this market existed. */
  cleanSheets?: {
    home: boolean;
    away: boolean;
  };
  teamCorners?: {
    home: boolean;
    away: boolean;
  };
  teamGoals?: {
    home: boolean;
    away: boolean;
  };
  bothTeamsToScore?: boolean;
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
      cleanSheets: {
        home: raw.finalScore.away === 0,
        away: raw.finalScore.home === 0,
      },
      teamCorners: {
        home: raw.corners.home > 4.5,
        away: raw.corners.away > 4.5,
      },
      teamGoals: {
        home: raw.finalScore.home > 1.5,
        away: raw.finalScore.away > 1.5,
      },
      bothTeamsToScore: raw.finalScore.home > 0 && raw.finalScore.away > 0,
    },
  };
}

export function isActualDrawOrOver2_5(actual: ActualMarkets): boolean {
  return actual.outcome.code === "X" || actual.goals.over2_5;
}

export function isActualFullTimeDraw(actual: ActualMarkets): boolean {
  return actual.outcome.code === "X";
}

export function isActualX2AndOver1_5(actual: ActualMarkets): boolean {
  return actual.outcome.code !== "1" && actual.goals.over1_5;
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
  | "fullTimeOutcome"
  | "firstHalfOutcome"
  | "winEitherHalf"
  | "highestScoringHalf"
  | "over1_5"
  | "over2_5"
  | "drawOrOver2_5"
  | "over7_5"
  | "over8_5"
  | "firstHalfOver3_5"
  | "doubleChance"
  | "homeCleanSheet"
  | "awayCleanSheet"
  | "homeCornersOver4_5"
  | "awayCornersOver4_5"
  | "homeGoalsOver1_5"
  | "awayGoalsOver1_5"
  | "bothTeamsToScore"
  | "x2AndOver1_5";

/**
 * Actively offered/tracked markets — drives booking pickers, the accuracy
 * page, and settled-match summaries. "over8_5" was pulled from this list
 * (2026-09-07): it settled at 42% across 167 matches, worse than a coin
 * flip, while over7_5 held at 54% — so corners stayed, that one line didn't.
 * "fullTimeDraw" (a bare "will it be a draw" yes/no) was replaced here by
 * "fullTimeOutcome" (2026-09-08) — the model already predicts the full
 * Home/Draw/Away result, so the market now shows that instead of collapsing
 * it to a binary draw call, matching how firstHalfOutcome already works.
 * Both retired keys stay in the MarketKey type (below) and every decode
 * function keeps handling them so already-published bookings and the
 * standalone "FT Draw" quick-filter/collection keep working correctly; they
 * just aren't offered as a fresh booking pick or shown in any new UI.
 */
export const MARKET_KEYS: MarketKey[] = [
  "fullTimeOutcome",
  "firstHalfOutcome",
  "winEitherHalf",
  "highestScoringHalf",
  "over1_5",
  "over2_5",
  "drawOrOver2_5",
  "over7_5",
  "firstHalfOver3_5",
  "doubleChance",
  "homeCleanSheet",
  "awayCleanSheet",
  "homeCornersOver4_5",
  "awayCornersOver4_5",
  "homeGoalsOver1_5",
  "awayGoalsOver1_5",
  "bothTeamsToScore",
  "x2AndOver1_5",
];

/**
 * Which full-time outcomes each Double Chance selection covers. Unlike every
 * other market here, correctness isn't a string-equality check against a
 * single "actual value" — two of the three selections are always "covered"
 * by any given result, so this is a set-membership test instead. See
 * isMarketCorrect/isPickCorrect's "doubleChance" cases.
 */
const DOUBLE_CHANCE_COVERAGE: Record<string, OutcomeCode[]> = {
  "1X": ["1", "X"],
  X2: ["X", "2"],
  "12": ["1", "2"],
};

function isDoubleChanceCorrect(selection: string, outcomeCode: OutcomeCode): boolean {
  return DOUBLE_CHANCE_COVERAGE[selection]?.includes(outcomeCode) ?? false;
}

export const MARKET_LABELS: Record<MarketKey, string> = {
  fullTimeDraw: "FT Draw",
  fullTimeOutcome: "FT Result",
  firstHalfOutcome: "1H Outcome",
  winEitherHalf: "Win Either Half",
  highestScoringHalf: "Highest Half",
  over1_5: "Over 1.5",
  over2_5: "Over 2.5",
  drawOrOver2_5: "Draw/O2.5",
  over7_5: "Corners O7.5",
  over8_5: "Corners O8.5",
  firstHalfOver3_5: "1H Corners O3.5",
  doubleChance: "Double Chance",
  homeCleanSheet: "Clean Sheet (Home)",
  awayCleanSheet: "Clean Sheet (Away)",
  homeCornersOver4_5: "Home Corners O4.5",
  awayCornersOver4_5: "Away Corners O4.5",
  homeGoalsOver1_5: "Home Goals O1.5",
  awayGoalsOver1_5: "Away Goals O1.5",
  bothTeamsToScore: "BTTS",
  x2AndOver1_5: "2X & Over 1.5",
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
    case "fullTimeOutcome":
      return predicted.outcome.code === actual.outcome.code;
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
    case "doubleChance": {
      const selection = marketPredictionValue(predicted, key);
      return selection === null ? null : isDoubleChanceCorrect(selection, actual.outcome.code);
    }
    case "homeCleanSheet":
      return !predicted.cleanSheets || !actual.cleanSheets
        ? null
        : predicted.cleanSheets.home === actual.cleanSheets.home;
    case "awayCleanSheet":
      return !predicted.cleanSheets || !actual.cleanSheets
        ? null
        : predicted.cleanSheets.away === actual.cleanSheets.away;
    case "homeCornersOver4_5":
      return !predicted.teamCorners || !actual.teamCorners
        ? null
        : predicted.teamCorners.home === actual.teamCorners.home;
    case "awayCornersOver4_5":
      return !predicted.teamCorners || !actual.teamCorners
        ? null
        : predicted.teamCorners.away === actual.teamCorners.away;
    case "homeGoalsOver1_5":
      return !predicted.teamGoals || !actual.teamGoals ? null : predicted.teamGoals.home === actual.teamGoals.home;
    case "awayGoalsOver1_5":
      return !predicted.teamGoals || !actual.teamGoals ? null : predicted.teamGoals.away === actual.teamGoals.away;
    case "bothTeamsToScore":
      return predicted.bothTeamsToScore === undefined || actual.bothTeamsToScore === undefined
        ? null
        : predicted.bothTeamsToScore === actual.bothTeamsToScore;
    case "x2AndOver1_5":
      return isX2AndOver1_5(predicted) === isActualX2AndOver1_5(actual);
  }
}

/**
 * Confidence (1-100) behind one specific market's call, rather than the one
 * blanket number covering the whole fixture. Null when the prediction
 * predates per-market confidence, or for over8_5 (retired, not surfaced
 * anywhere new). Combo markets don't have their own Claude-asked number —
 * their confidence is derived from whichever underlying primitive actually
 * determines the combo's value, same as the value itself is derived rather
 * than asked for directly.
 */
export function marketConfidence(predicted: HydratedMarkets, key: MarketKey): number | null {
  const mc = predicted.confidence;
  if (!mc) return null;
  switch (key) {
    case "fullTimeDraw":
    case "fullTimeOutcome":
    case "doubleChance":
      return mc.o;
    case "firstHalfOutcome":
      return mc.ht;
    case "winEitherHalf":
      // Needs both halves to go this side's way (or the other side to win
      // neither) — only as strong as the less confident of the two reads.
      return Math.min(mc.ht, mc.h2);
    case "highestScoringHalf":
      return mc.sh;
    case "over1_5":
      return mc.g1;
    case "over2_5":
      return mc.g2;
    case "drawOrOver2_5":
      // True because a draw OR an over-2.5 read holds — confidence follows
      // whichever one actually drives the call. False needs both to fail,
      // so it's bounded by the weaker of the two "no" reads.
      if (predicted.outcome.code === "X") return mc.o;
      if (predicted.goals.over2_5) return mc.g2;
      return Math.min(mc.o, mc.g2);
    case "over7_5":
      return mc.c1;
    case "over8_5":
      return null;
    case "firstHalfOver3_5":
      return mc.c3;
    case "homeCleanSheet":
      return mc.csh;
    case "awayCleanSheet":
      return mc.csa;
    case "homeCornersOver4_5":
      return mc.tch;
    case "awayCornersOver4_5":
      return mc.tca;
    case "homeGoalsOver1_5":
      return mc.tgh;
    case "awayGoalsOver1_5":
      return mc.tga;
    case "bothTeamsToScore":
      return mc.btts;
    case "x2AndOver1_5":
      // AND combo — bounded by the weaker of the two legs. "Not home" isn't
      // its own asked number, so mc.o (confidence in the model's own
      // outcome pick) stands in for it, same approximation drawOrOver2_5 uses.
      if (predicted.outcome.code === "1") return mc.o;
      return Math.min(mc.o, mc.g1);
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
    case "fullTimeOutcome":
      return predicted.outcome.label;
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
    case "doubleChance": {
      const v = marketPredictionValue(predicted, key);
      return v === null ? "–" : marketValueLabel(key, v);
    }
    case "homeCleanSheet":
      return predicted.cleanSheets ? (predicted.cleanSheets.home ? "Yes" : "No") : "–";
    case "awayCleanSheet":
      return predicted.cleanSheets ? (predicted.cleanSheets.away ? "Yes" : "No") : "–";
    case "homeCornersOver4_5":
      return predicted.teamCorners ? (predicted.teamCorners.home ? "Yes" : "No") : "–";
    case "awayCornersOver4_5":
      return predicted.teamCorners ? (predicted.teamCorners.away ? "Yes" : "No") : "–";
    case "homeGoalsOver1_5":
      return predicted.teamGoals ? (predicted.teamGoals.home ? "Yes" : "No") : "–";
    case "awayGoalsOver1_5":
      return predicted.teamGoals ? (predicted.teamGoals.away ? "Yes" : "No") : "–";
    case "bothTeamsToScore":
      return predicted.bothTeamsToScore === undefined ? "–" : predicted.bothTeamsToScore ? "Yes" : "No";
    case "x2AndOver1_5":
      return isX2AndOver1_5(predicted) ? "Yes" : "No";
  }
}

export interface MarketOption {
  /** Short code stored on booking_items.user_value and compared against actualMarketValue when grading. */
  value: string;
  label: string;
}

const YES_NO_OPTIONS: MarketOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** The selectable sides for a market, for a booking pick's "which side" UI — in SoccerRadar's own predicted order first (Home/Draw/Away, not alphabetical). */
export function marketOptions(key: MarketKey): MarketOption[] {
  switch (key) {
    case "fullTimeOutcome":
    case "firstHalfOutcome":
      return [
        { value: "1", label: "Home" },
        { value: "X", label: "Draw" },
        { value: "2", label: "Away" },
      ];
    case "winEitherHalf":
      return [
        { value: "1", label: "Home" },
        { value: "2", label: "Away" },
      ];
    case "highestScoringHalf":
      return [
        { value: "1st", label: "First Half" },
        { value: "2nd", label: "Second Half" },
        { value: "Equal", label: "Evenly Split" },
      ];
    case "doubleChance":
      return [
        { value: "1X", label: "Home/Draw" },
        { value: "X2", label: "Draw/Away" },
        { value: "12", label: "Home/Away" },
      ];
    default:
      return YES_NO_OPTIONS;
  }
}

/** Turns a stored user_value/prediction code back into its display label — same codes marketOptions() offers. */
export function marketValueLabel(key: MarketKey, value: string): string {
  return marketOptions(key).find((o) => o.value === value)?.label ?? value;
}

/**
 * SoccerRadar's own call for this market, as the short code stored in
 * booking_items.user_value — the counterpart to marketPredictionLabel(),
 * used to pre-select the default option when a user is picking a side.
 * Null only for winEitherHalf on a prediction generated before that market
 * existed (see winEitherHalfCode).
 */
export function marketPredictionValue(predicted: HydratedMarkets, key: MarketKey): string | null {
  switch (key) {
    case "fullTimeDraw":
      return isFullTimeDraw(predicted) ? "yes" : "no";
    case "fullTimeOutcome":
      return predicted.outcome.code;
    case "firstHalfOutcome":
      return predicted.firstHalfOutcome.code;
    case "winEitherHalf":
      return winEitherHalfCode(predicted);
    case "highestScoringHalf":
      return predicted.highestScoringHalf.code;
    case "over1_5":
      return predicted.goals.over1_5 ? "yes" : "no";
    case "over2_5":
      return predicted.goals.over2_5 ? "yes" : "no";
    case "drawOrOver2_5":
      return isDrawOrOver2_5(predicted) ? "yes" : "no";
    case "over7_5":
      return predicted.corners.over7_5 ? "yes" : "no";
    case "over8_5":
      return predicted.corners.over8_5 ? "yes" : "no";
    case "firstHalfOver3_5":
      return predicted.corners.firstHalfOver3_5 ? "yes" : "no";
    case "doubleChance":
      // No principled single pick when the model's own FT call is a draw —
      // "1X" and "X2" both include it with nothing to choose between them,
      // and "12" would directly contradict the model's own outcome pick.
      if (predicted.outcome.code === "1") return "1X";
      if (predicted.outcome.code === "2") return "X2";
      return null;
    case "homeCleanSheet":
      return predicted.cleanSheets ? (predicted.cleanSheets.home ? "yes" : "no") : null;
    case "awayCleanSheet":
      return predicted.cleanSheets ? (predicted.cleanSheets.away ? "yes" : "no") : null;
    case "homeCornersOver4_5":
      return predicted.teamCorners ? (predicted.teamCorners.home ? "yes" : "no") : null;
    case "awayCornersOver4_5":
      return predicted.teamCorners ? (predicted.teamCorners.away ? "yes" : "no") : null;
    case "homeGoalsOver1_5":
      return predicted.teamGoals ? (predicted.teamGoals.home ? "yes" : "no") : null;
    case "awayGoalsOver1_5":
      return predicted.teamGoals ? (predicted.teamGoals.away ? "yes" : "no") : null;
    case "bothTeamsToScore":
      return predicted.bothTeamsToScore === undefined ? null : predicted.bothTeamsToScore ? "yes" : "no";
    case "x2AndOver1_5":
      return isX2AndOver1_5(predicted) ? "yes" : "no";
  }
}

/**
 * What actually happened for this market, as the same short code
 * marketPredictionValue()/user_value use — lets a user's override be graded
 * with a plain string comparison. Null when the actual result can't tell
 * this market apart (only firstHalfOver3_5, when HT corners weren't recorded).
 *
 * Exception: "doubleChance" returns the raw outcome code ("1"/"X"/"2"), not
 * a "1X"-style selection — there's no single selection two of the three
 * options don't also satisfy, so grading it is a set-membership check
 * (isDoubleChanceCorrect), not string equality. isPickCorrect special-cases
 * it below rather than using this value directly.
 */
export function actualMarketValue(actual: ActualMarkets, key: MarketKey): string | null {
  switch (key) {
    case "fullTimeDraw":
      return isActualFullTimeDraw(actual) ? "yes" : "no";
    case "fullTimeOutcome":
      return actual.outcome.code;
    case "firstHalfOutcome":
      return actual.firstHalfOutcome.code;
    case "winEitherHalf":
      return actualWinEitherHalfCode(actual);
    case "highestScoringHalf":
      return actual.highestScoringHalf.code;
    case "over1_5":
      return actual.goals.over1_5 ? "yes" : "no";
    case "over2_5":
      return actual.goals.over2_5 ? "yes" : "no";
    case "drawOrOver2_5":
      return isActualDrawOrOver2_5(actual) ? "yes" : "no";
    case "over7_5":
      return actual.corners.over7_5 ? "yes" : "no";
    case "over8_5":
      return actual.corners.over8_5 ? "yes" : "no";
    case "firstHalfOver3_5":
      return actual.corners.firstHalfOver3_5 === null ? null : actual.corners.firstHalfOver3_5 ? "yes" : "no";
    case "doubleChance":
      return actual.outcome.code;
    case "homeCleanSheet":
      return actual.cleanSheets ? (actual.cleanSheets.home ? "yes" : "no") : null;
    case "awayCleanSheet":
      return actual.cleanSheets ? (actual.cleanSheets.away ? "yes" : "no") : null;
    case "homeCornersOver4_5":
      return actual.teamCorners ? (actual.teamCorners.home ? "yes" : "no") : null;
    case "awayCornersOver4_5":
      return actual.teamCorners ? (actual.teamCorners.away ? "yes" : "no") : null;
    case "homeGoalsOver1_5":
      return actual.teamGoals ? (actual.teamGoals.home ? "yes" : "no") : null;
    case "awayGoalsOver1_5":
      return actual.teamGoals ? (actual.teamGoals.away ? "yes" : "no") : null;
    case "bothTeamsToScore":
      return actual.bothTeamsToScore === undefined ? null : actual.bothTeamsToScore ? "yes" : "no";
    case "x2AndOver1_5":
      return isActualX2AndOver1_5(actual) ? "yes" : "no";
  }
}

/**
 * Was this pick right? Grades against the user's own override when a
 * booking_item has one (a deliberate call against SoccerRadar's own
 * prediction), otherwise falls back to isMarketCorrect's normal behavior —
 * every existing pick with no override keeps grading exactly as before.
 */
export function isPickCorrect(
  userValue: string | null | undefined,
  predicted: HydratedMarkets,
  actual: ActualMarkets,
  key: MarketKey,
): boolean | null {
  if (userValue) {
    if (key === "doubleChance") return isDoubleChanceCorrect(userValue, actual.outcome.code);
    const actualValue = actualMarketValue(actual, key);
    return actualValue === null ? null : userValue === actualValue;
  }
  return isMarketCorrect(predicted, actual, key);
}

const MARKET_CONFIDENCE_KEYS = ["o", "ht", "h2", "sh", "g1", "g2", "c1", "c3", "csh", "csa", "tch", "tca", "tgh", "tga", "btts"] as const;

function isMarketConfidences(value: unknown): value is MarketConfidences {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return MARKET_CONFIDENCE_KEYS.every((key) => typeof v[key] === "number");
}

export function isCompactPrediction(value: unknown): value is CompactPrediction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    (v.o === "1" || v.o === "X" || v.o === "2") &&
    (v.ht === "1" || v.ht === "X" || v.ht === "2") &&
    (v.h2 === "1" || v.h2 === "X" || v.h2 === "2") &&
    (v.sh === "1st" || v.sh === "2nd" || v.sh === "Equal") &&
    Array.isArray(v.g) &&
    v.g.length === 2 &&
    Array.isArray(v.c) &&
    v.c.length === 3 &&
    Array.isArray(v.cs) &&
    v.cs.length === 2 &&
    Array.isArray(v.tc) &&
    v.tc.length === 2 &&
    Array.isArray(v.tg) &&
    v.tg.length === 2 &&
    (v.btts === 0 || v.btts === 1) &&
    isMarketConfidences(v.mc) &&
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
