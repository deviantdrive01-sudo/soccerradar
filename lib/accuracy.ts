import { isMarketCorrect, MARKET_KEYS, MARKET_LABELS, type MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export interface MarketAccuracy {
  key: MarketKey;
  label: string;
  correct: number;
  known: number;
}

export interface AccuracySummary {
  totalSettled: number;
  overallCorrect: number;
  overallKnown: number;
  perMarket: MarketAccuracy[];
}

export function computeAccuracy(predictions: Prediction[]): AccuracySummary {
  // A match can in rare cases settle before it was ever predicted (crawled,
  // kickoff passed before a prediction was generated) — nothing to grade.
  const settled = predictions.filter((p) => p.actual_result !== null && p.markets !== null);

  const perMarket: MarketAccuracy[] = MARKET_KEYS.map((key) => {
    let correct = 0;
    let known = 0;
    for (const p of settled) {
      const result = isMarketCorrect(p.markets!, p.actual_result!.markets, key);
      if (result !== null) {
        known++;
        if (result) correct++;
      }
    }
    return { key, label: MARKET_LABELS[key], correct, known };
  });

  return {
    totalSettled: settled.length,
    overallCorrect: perMarket.reduce((sum, m) => sum + m.correct, 0),
    overallKnown: perMarket.reduce((sum, m) => sum + m.known, 0),
    perMarket,
  };
}

export interface LeagueAccuracy {
  leagueId: number;
  leagueName: string;
  summary: AccuracySummary;
}

export function computeAccuracyByLeague(
  predictions: Prediction[],
  leagueById: Map<number, { name: string }>,
): LeagueAccuracy[] {
  const byLeague = new Map<number, Prediction[]>();
  for (const p of predictions) {
    if (!p.actual_result) continue;
    const existing = byLeague.get(p.league_id);
    if (existing) existing.push(p);
    else byLeague.set(p.league_id, [p]);
  }

  return Array.from(byLeague, ([leagueId, preds]) => ({
    leagueId,
    leagueName: leagueById.get(leagueId)?.name ?? "Unknown",
    summary: computeAccuracy(preds),
  })).sort((a, b) => b.summary.totalSettled - a.summary.totalSettled);
}

export function accuracyPct(correct: number, known: number): number {
  return known ? Math.round((correct / known) * 100) : 0;
}

/** Shared color threshold for any "% correct" badge across the site. Green
 * for a win reads more universally than the brand color would (which turns
 * yellow in dark mode) — kept as plain emerald regardless of theme. */
export function pctClass(pct: number, known: number): string {
  if (known === 0) return "border-border/60 text-muted-foreground";
  if (pct >= 60) return "border-emerald-500/30 text-emerald-400";
  if (pct >= 45) return "border-amber-500/30 text-amber-400";
  return "border-red-500/30 text-red-400";
}
