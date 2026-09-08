import "server-only";
import { marketConfidence, marketPredictionLabel, marketPredictionValue, type MarketKey } from "@/lib/hydrate";
import { isPredicted, type Prediction } from "@/lib/supabase/types";

/**
 * Curated "Top X" categories for the Telegram bot — a pick only qualifies if
 * the model's own per-market confidence (not the blanket match-level number)
 * clears the bar for that specific market. Thresholds set 2026-09-08: lower
 * for over_2_5 since it's typically a lower-confidence read than over_1_5.
 */
export type TopMarketSlug = "over15" | "over25" | "corners";

export interface TopMarketConfig {
  marketKey: MarketKey;
  minConfidence: number;
  title: string;
}

export const TOP_MARKET_CONFIGS: Record<TopMarketSlug, TopMarketConfig> = {
  over15: { marketKey: "over1_5", minConfidence: 55, title: "Top Over 1.5" },
  over25: { marketKey: "over2_5", minConfidence: 45, title: "Top Over 2.5" },
  corners: { marketKey: "over7_5", minConfidence: 50, title: "Top Corners" },
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

/** Keeps only predictions where this market's own call is "yes" and its own confidence clears the bar, ranked by that confidence — not the row's overall confidence. */
export function filterTopMarketPicks(predictions: Prediction[], leagueById: Map<number, string>, config: TopMarketConfig): FilteredPick[] {
  return predictions
    .map((p) => {
      if (!isPredicted(p)) return null;
      const value = marketPredictionValue(p.markets, config.marketKey);
      const confidence = marketConfidence(p.markets, config.marketKey);
      if (value !== "yes" || confidence === null || confidence < config.minConfidence) return null;
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
