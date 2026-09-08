import "server-only";
import { marketConfidence, marketPredictionLabel, marketPredictionValue, type MarketKey } from "@/lib/hydrate";
import { isPredicted, type Prediction } from "@/lib/supabase/types";

/**
 * Curated "Top X" categories for the Telegram bot — a pick only qualifies if
 * the model's own per-market confidence (not the blanket match-level number)
 * clears the bar for that specific market. Thresholds set 2026-09-08: lower
 * for over_2_5 since it's typically a lower-confidence read than over_1_5.
 */
export type TopMarketSlug =
  | "over15"
  | "over25"
  | "corners"
  | "1x"
  | "x2"
  | "ftdraw"
  | "1hhome"
  | "1hdraw"
  | "1haway"
  | "firsthalf"
  | "secondhalf"
  | "evenhalf"
  | "winhalfhome"
  | "winhalfaway"
  | "1hcorners"
  | "cshome"
  | "csaway";

export interface TopMarketConfig {
  marketKey: MarketKey;
  /** The specific value marketPredictionValue() must return for this pick to qualify — "yes" for boolean markets, a specific code (e.g. "1X") for categorical ones like doubleChance. */
  targetValue: string;
  minConfidence: number;
  title: string;
  /** Slash command name (no leading "/") — Telegram commands allow only lowercase letters/digits/underscores. */
  command: string;
}

// Thresholds set 2026-09-08, over1_5 lowered 55%->50% the same day per the
// scheduled-broadcast spec ("all over 1.5 from 50%"); over_2_5 stays lower
// still since it naturally runs a lower-confidence read than over_1_5.
// Everything added afterward uses a flat 60% bar per direct instruction,
// rather than tuning each one individually without real accuracy data to
// back a different number yet.
export const TOP_MARKET_CONFIGS: Record<TopMarketSlug, TopMarketConfig> = {
  over15: { marketKey: "over1_5", targetValue: "yes", minConfidence: 50, title: "Top Over 1.5", command: "topover15" },
  over25: { marketKey: "over2_5", targetValue: "yes", minConfidence: 45, title: "Top Over 2.5", command: "topover25" },
  corners: { marketKey: "over7_5", targetValue: "yes", minConfidence: 50, title: "Top Corners", command: "topcorners" },
  "1x": { marketKey: "doubleChance", targetValue: "1X", minConfidence: 60, title: "Top 1X (Home/Draw)", command: "top1x" },
  x2: { marketKey: "doubleChance", targetValue: "X2", minConfidence: 60, title: "Top X2 (Draw/Away)", command: "topx2" },
  ftdraw: { marketKey: "fullTimeOutcome", targetValue: "X", minConfidence: 60, title: "Top FT Draw", command: "topdraw" },
  "1hhome": { marketKey: "firstHalfOutcome", targetValue: "1", minConfidence: 60, title: "Top 1H Home Win", command: "top1hhome" },
  "1hdraw": { marketKey: "firstHalfOutcome", targetValue: "X", minConfidence: 60, title: "Top 1H Draw", command: "top1hdraw" },
  "1haway": { marketKey: "firstHalfOutcome", targetValue: "2", minConfidence: 60, title: "Top 1H Away Win", command: "top1haway" },
  firsthalf: { marketKey: "highestScoringHalf", targetValue: "1st", minConfidence: 60, title: "Top First Half (Highest Scoring)", command: "topfirsthalf" },
  secondhalf: { marketKey: "highestScoringHalf", targetValue: "2nd", minConfidence: 60, title: "Top Second Half (Highest Scoring)", command: "topsecondhalf" },
  evenhalf: { marketKey: "highestScoringHalf", targetValue: "Equal", minConfidence: 60, title: "Top Evenly Split Half", command: "topevenhalf" },
  winhalfhome: { marketKey: "winEitherHalf", targetValue: "1", minConfidence: 60, title: "Top Win Either Half: Home", command: "topwinhalfhome" },
  winhalfaway: { marketKey: "winEitherHalf", targetValue: "2", minConfidence: 60, title: "Top Win Either Half: Away", command: "topwinhalfaway" },
  "1hcorners": { marketKey: "firstHalfOver3_5", targetValue: "yes", minConfidence: 60, title: "Top 1H Corners O3.5", command: "top1hcorners" },
  cshome: { marketKey: "homeCleanSheet", targetValue: "yes", minConfidence: 60, title: "Top Clean Sheet (Home)", command: "topcshome" },
  csaway: { marketKey: "awayCleanSheet", targetValue: "yes", minConfidence: 60, title: "Top Clean Sheet (Away)", command: "topcsaway" },
};

export function isTopMarketSlug(value: string): value is TopMarketSlug {
  return value in TOP_MARKET_CONFIGS;
}

export interface FilteredPick {
  id: number;
  home_team: string;
  away_team: string;
  leagueName: string;
  label: string;
  confidence: number;
}

/** Keeps only predictions where this market's own call matches the target value and its own confidence clears the bar, ranked by that confidence — not the row's overall confidence. */
export function filterTopMarketPicks(predictions: Prediction[], leagueById: Map<number, string>, config: TopMarketConfig): FilteredPick[] {
  return predictions
    .map((p) => {
      if (!isPredicted(p)) return null;
      const value = marketPredictionValue(p.markets, config.marketKey);
      const confidence = marketConfidence(p.markets, config.marketKey);
      if (value !== config.targetValue || confidence === null || confidence < config.minConfidence) return null;
      return {
        id: p.id,
        home_team: p.home_team,
        away_team: p.away_team,
        leagueName: leagueById.get(p.league_id) ?? "",
        label: marketPredictionLabel(p.markets, config.marketKey),
        confidence,
      };
    })
    .filter((x): x is FilteredPick => x !== null)
    .sort((a, b) => b.confidence - a.confidence);
}
