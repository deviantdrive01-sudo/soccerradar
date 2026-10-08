/**
 * Stat-only prediction engine — no LLM involved. Derives every market from
 * two independent-Poisson goal distributions (home/away expected goals)
 * computed purely from API-Football's own team summaries, plus a simple
 * average over the fixture's own h2h corners/shots for the two stat
 * markets Poisson can't reach. Operates entirely on an already-fetched
 * `ApiFootballPredictionContext` — no new API calls, no `server-only`
 * (same reasoning as lib/api-football-context.ts: needs to run from a
 * plain-tsx script, not just inside Next's server runtime).
 *
 * As of 2026-10, this is the live engine for every fixture that didn't
 * already have a Claude-generated prediction (see scripts/generate-stat-
 * predictions.ts, which writes into `predictions.markets` for rows where
 * it's still null) — the ~831 already-published, already-graded Claude
 * predictions are left untouched; this only fills in what's still empty.
 * scripts/compare-engines.ts remains for comparing the two going forward.
 *
 * Deliberately simple: independent-Poisson is the standard baseline real
 * statistical models start from, before Dixon-Coles-style low-score
 * correlation corrections or league-wide attack/defense normalization —
 * both would need data (league-wide scoring averages) this module doesn't
 * have access to without new fetching, out of scope for this round.
 */
import type { HydratedMarkets, MarketConfidences, OutcomeCode, ScoringHalfCode } from "./hydrate";
import type { ApiFootballH2hMeeting, ApiFootballPredictionContext, ApiFootballTeamSummary } from "./supabase/types";

// ---------- Poisson primitives ----------

const GRID_MAX = 9; // goals per side considered in joint-distribution sums — captures >99.9% of mass for realistic football lambdas

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/** P(side A's draw > side B's draw) / tie / (A < B) for two independent Poisson variables — used for both full-time outcome (home vs away goals) and highest-scoring-half (1st-half vs 2nd-half total goals). Normalized so the three probabilities sum to 1 despite the grid's finite cutoff. */
function poissonRace(lambdaA: number, lambdaB: number): { aWins: number; tie: number; bWins: number } {
  let aWins = 0;
  let tie = 0;
  let bWins = 0;
  for (let a = 0; a <= GRID_MAX; a++) {
    const pa = poissonPmf(a, lambdaA);
    for (let b = 0; b <= GRID_MAX; b++) {
      const p = pa * poissonPmf(b, lambdaB);
      if (a > b) aWins += p;
      else if (a === b) tie += p;
      else bWins += p;
    }
  }
  const total = aWins + tie + bWins;
  return { aWins: aWins / total, tie: tie / total, bWins: bWins / total };
}

/** P(a Poisson(lambda) variable exceeds `line`) — line is always a .5 value (over7_5 etc.), so no tie case. */
function poissonOverProb(lambda: number, line: number): number {
  const threshold = Math.floor(line); // over 2.5 means >= 3, i.e. > floor(2.5)
  let underOrEqual = 0;
  for (let k = 0; k <= threshold; k++) underOrEqual += poissonPmf(k, lambda);
  return 1 - underOrEqual;
}

const pct = (p: number) => Math.round(Math.min(99, Math.max(1, p * 100)));

// ---------- Expected goals ----------

const HOME_ADVANTAGE = 1.12; // commonly-cited average home-goals multiplier in football — tunable
const MIN_LAMBDA = 0.15; // keeps Poisson math sane when a team has an unusually low/zero scoring rate on record

export interface StatEngineLambdas {
  home: number;
  away: number;
}

function computeLambdas(home: ApiFootballTeamSummary, away: ApiFootballTeamSummary): StatEngineLambdas | null {
  if (home.goalsForAvg === null || home.goalsAgainstAvg === null || away.goalsForAvg === null || away.goalsAgainstAvg === null) {
    return null;
  }
  const rawHome = (home.goalsForAvg + away.goalsAgainstAvg) / 2;
  const rawAway = (away.goalsForAvg + home.goalsAgainstAvg) / 2;
  return {
    home: Math.max(MIN_LAMBDA, rawHome * HOME_ADVANTAGE),
    away: Math.max(MIN_LAMBDA, rawAway),
  };
}

// ---------- Corners/shots from the fixture's own h2h sample ----------
// API-Football's team summaries carry no season corner/shot averages (only
// /fixtures/statistics, a match-level endpoint, has those) — so these two
// markets fall back to averaging whatever real corners/shots exist across
// this fixture's own stored h2h meetings. Small sample, no form signal —
// the weakest part of this model, flagged here rather than hidden.

const FIRST_HALF_GOAL_SHARE = 0.44; // ~44% of goals happen in the 1st half — standard football stat, applied to lambdas for half-specific markets
const FIRST_HALF_CORNER_SHARE = 0.42; // similar spirit for corners

interface StatPair {
  home: number;
  away: number;
}

function averageH2hStat(h2h: ApiFootballH2hMeeting[], pick: (m: ApiFootballH2hMeeting) => StatPair | null | undefined): StatPair | null {
  const samples = h2h.map(pick).filter((s): s is StatPair => !!s);
  if (samples.length === 0) return null;
  const home = samples.reduce((sum, s) => sum + s.home, 0) / samples.length;
  const away = samples.reduce((sum, s) => sum + s.away, 0) / samples.length;
  return { home, away };
}

/** Heuristic confidence (not a true probability, unlike the Poisson-derived ones) — scales with how far the averaged value sits from the line. */
function marginConfidence(value: number, line: number, scale: number): number {
  const margin = Math.abs(value - line);
  return Math.min(85, Math.max(50, Math.round(50 + margin * scale)));
}

// ---------- Orchestration ----------

export interface StatEnginePrediction {
  markets: HydratedMarkets;
  confidence: number;
  /** Debug/audit trail — what went into this call. */
  inputs: {
    lambdas: StatEngineLambdas;
    avgCorners: StatPair | null;
    avgShots: StatPair | null;
    h2hSampleSize: number;
  };
}

/**
 * Computes a full HydratedMarkets prediction from an already-fetched
 * API-Football context — no network calls. Returns null when the team
 * summaries don't have enough data (goalsForAvg/goalsAgainstAvg missing —
 * happens for teams with very little season history, e.g. just promoted
 * or a cup minnow API-Football has thin coverage on).
 */
export function computeStatPrediction(context: ApiFootballPredictionContext): StatEnginePrediction | null {
  const lambdas = computeLambdas(context.teams.home, context.teams.away);
  if (!lambdas) return null;

  const totalLambda = lambdas.home + lambdas.away;
  const ft = poissonRace(lambdas.home, lambdas.away);
  const outcomeCode: OutcomeCode = ft.aWins >= ft.tie && ft.aWins >= ft.bWins ? "1" : ft.bWins >= ft.tie ? "2" : "X";
  const outcomeConfidence = outcomeCode === "1" ? ft.aWins : outcomeCode === "2" ? ft.bWins : ft.tie;

  const htLambdas = { home: lambdas.home * FIRST_HALF_GOAL_SHARE, away: lambdas.away * FIRST_HALF_GOAL_SHARE };
  const shLambdas = { home: lambdas.home * (1 - FIRST_HALF_GOAL_SHARE), away: lambdas.away * (1 - FIRST_HALF_GOAL_SHARE) };
  const ht = poissonRace(htLambdas.home, htLambdas.away);
  const sh = poissonRace(shLambdas.home, shLambdas.away);
  const htCode: OutcomeCode = ht.aWins >= ht.tie && ht.aWins >= ht.bWins ? "1" : ht.bWins >= ht.tie ? "2" : "X";
  const shCode: OutcomeCode = sh.aWins >= sh.tie && sh.aWins >= sh.bWins ? "1" : sh.bWins >= sh.tie ? "2" : "X";
  const htConfidence = htCode === "1" ? ht.aWins : htCode === "2" ? ht.bWins : ht.tie;
  const h2Confidence = shCode === "1" ? sh.aWins : shCode === "2" ? sh.bWins : sh.tie;

  const halvesRace = poissonRace(htLambdas.home + htLambdas.away, shLambdas.home + shLambdas.away);
  const highestScoringHalf: ScoringHalfCode =
    halvesRace.aWins >= halvesRace.tie && halvesRace.aWins >= halvesRace.bWins
      ? "1st"
      : halvesRace.bWins >= halvesRace.tie
        ? "2nd"
        : "Equal";
  const shConfidenceOverall =
    highestScoringHalf === "1st" ? halvesRace.aWins : highestScoringHalf === "2nd" ? halvesRace.bWins : halvesRace.tie;

  const over1_5Prob = poissonOverProb(totalLambda, 1.5);
  const over2_5Prob = poissonOverProb(totalLambda, 2.5);
  const pHomeScoreless = poissonPmf(0, lambdas.home);
  const pAwayScoreless = poissonPmf(0, lambdas.away);
  const bttsProb = (1 - pHomeScoreless) * (1 - pAwayScoreless);
  const homeOver1_5Prob = 1 - poissonPmf(0, lambdas.home) - poissonPmf(1, lambdas.home);
  const awayOver1_5Prob = 1 - poissonPmf(0, lambdas.away) - poissonPmf(1, lambdas.away);

  const avgCorners = averageH2hStat(context.h2h, (m) => m.corners ?? null);
  const avgShots = averageH2hStat(context.h2h, (m) => m.totalShots ?? null);
  const cornersTotal = avgCorners ? avgCorners.home + avgCorners.away : null;
  const shotsTotal = avgShots ? avgShots.home + avgShots.away : null;
  const over7_5 = cornersTotal !== null ? cornersTotal > 7.5 : false;
  const corners1hTotal = cornersTotal !== null ? cornersTotal * FIRST_HALF_CORNER_SHARE : null;
  const firstHalfOver3_5 = corners1hTotal !== null ? corners1hTotal > 3.5 : false;
  const shotsOver22_5 = shotsTotal !== null ? shotsTotal > 22.5 : false;
  const homeCornersOver4_5 = avgCorners ? avgCorners.home > 4.5 : false;
  const awayCornersOver4_5 = avgCorners ? avgCorners.away > 4.5 : false;

  const c1Confidence = cornersTotal !== null ? marginConfidence(cornersTotal, 7.5, 8) : 50;
  const c3Confidence = corners1hTotal !== null ? marginConfidence(corners1hTotal, 3.5, 10) : 50;
  const s1Confidence = shotsTotal !== null ? marginConfidence(shotsTotal, 22.5, 3) : 50;
  const tchConfidence = avgCorners ? marginConfidence(avgCorners.home, 4.5, 10) : 50;
  const tcaConfidence = avgCorners ? marginConfidence(avgCorners.away, 4.5, 10) : 50;

  const confidence: MarketConfidences = {
    o: pct(outcomeConfidence),
    ht: pct(htConfidence),
    h2: pct(h2Confidence),
    sh: pct(shConfidenceOverall),
    g1: pct(over1_5Prob >= 0.5 ? over1_5Prob : 1 - over1_5Prob),
    g2: pct(over2_5Prob >= 0.5 ? over2_5Prob : 1 - over2_5Prob),
    c1: c1Confidence,
    c3: c3Confidence,
    csh: pct(pAwayScoreless >= 0.5 ? pAwayScoreless : 1 - pAwayScoreless),
    csa: pct(pHomeScoreless >= 0.5 ? pHomeScoreless : 1 - pHomeScoreless),
    tch: tchConfidence,
    tca: tcaConfidence,
    tgh: pct(homeOver1_5Prob >= 0.5 ? homeOver1_5Prob : 1 - homeOver1_5Prob),
    tga: pct(awayOver1_5Prob >= 0.5 ? awayOver1_5Prob : 1 - awayOver1_5Prob),
    btts: pct(bttsProb >= 0.5 ? bttsProb : 1 - bttsProb),
    s1: s1Confidence,
  };

  const markets: HydratedMarkets = {
    outcome: { code: outcomeCode, label: OUTCOME_LABELS[outcomeCode] },
    firstHalfOutcome: { code: htCode, label: OUTCOME_LABELS[htCode] },
    secondHalfOutcome: { code: shCode, label: OUTCOME_LABELS[shCode] },
    highestScoringHalf: { code: highestScoringHalf, label: SCORING_HALF_LABELS[highestScoringHalf] },
    goals: { over1_5: over1_5Prob > 0.5, over2_5: over2_5Prob > 0.5 },
    corners: { over7_5, over8_5: cornersTotal !== null ? cornersTotal > 8.5 : false, firstHalfOver3_5 },
    cleanSheets: { home: pAwayScoreless > 0.5, away: pHomeScoreless > 0.5 },
    teamCorners: { home: homeCornersOver4_5, away: awayCornersOver4_5 },
    teamGoals: { home: homeOver1_5Prob > 0.5, away: awayOver1_5Prob > 0.5 },
    bothTeamsToScore: bttsProb > 0.5,
    shots: { over22_5: shotsOver22_5 },
    confidence,
  };

  const overallConfidence = pct(
    (outcomeConfidence + (over1_5Prob >= 0.5 ? over1_5Prob : 1 - over1_5Prob) + (over2_5Prob >= 0.5 ? over2_5Prob : 1 - over2_5Prob)) / 3,
  );

  return {
    markets,
    confidence: overallConfidence,
    inputs: { lambdas, avgCorners, avgShots, h2hSampleSize: context.h2h.length },
  };
}

const OUTCOME_LABELS: Record<OutcomeCode, string> = { "1": "Home Win", X: "Draw", "2": "Away Win" };
const SCORING_HALF_LABELS: Record<ScoringHalfCode, string> = { "1st": "First Half", "2nd": "Second Half", Equal: "Evenly Split" };

/** A plain templated sentence — no LLM, so no real "tactical reasoning", just stating what the numbers say. Written to predictions.summary, which the match page displays prominently. */
export function statEngineSummary(prediction: StatEnginePrediction, homeTeam: string, awayTeam: string): string {
  const { markets } = prediction;
  const favored = markets.outcome.code === "1" ? homeTeam : markets.outcome.code === "2" ? awayTeam : null;
  const outcomeText = favored ? `${favored} favored to win` : "a close game, leaning toward a draw";
  const goalsText = markets.goals.over2_5 ? "over 2.5 goals expected" : "a tighter, lower-scoring game expected";
  return `Stat model (Poisson-based on current scoring form — no AI judgment involved): ${outcomeText}, ${goalsText}.`;
}
