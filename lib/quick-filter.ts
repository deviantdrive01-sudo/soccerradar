import { winEitherHalfCode } from "@/lib/hydrate";
import type { MarketFilter } from "@/components/market-filter";
import type { Prediction } from "@/lib/supabase/types";

export const QUICK_FILTER_NONE = "none";

export type QuickFilter =
  | typeof QUICK_FILTER_NONE
  | "cornersO7_5Yes"
  | "halfDrawYes"
  | "over1_5Yes"
  | "over2_5Yes"
  | "winEitherYes";

export interface QuickFilterOption {
  value: QuickFilter;
  /** Short label for the quick-filter dropdown, e.g. "Corners O7.5: Yes". */
  label: string;
  /** URL-safe slug used for the shareable /top-picks/[slug] collection page. */
  slug: string;
  /** Reads naturally as a page heading, e.g. "Corners Over 7.5". */
  collectionTitle: string;
  /** Which market-filter columns best represent this pick on a card/table. */
  marketFilter: MarketFilter;
}

export const QUICK_FILTER_OPTIONS: QuickFilterOption[] = [
  {
    value: "cornersO7_5Yes",
    label: "Corners O7.5: Yes",
    slug: "corners-over-7-5",
    collectionTitle: "Corners Over 7.5",
    marketFilter: "corners",
  },
  {
    value: "halfDrawYes",
    label: "Half Draw: Yes",
    slug: "half-draw",
    collectionTitle: "Half-Time Draw",
    marketFilter: "ftDraw",
  },
  {
    value: "over1_5Yes",
    label: "Over 1.5: Yes",
    slug: "over-1-5",
    collectionTitle: "Over 1.5 Goals",
    marketFilter: "goals",
  },
  {
    value: "over2_5Yes",
    label: "Over 2.5: Yes",
    slug: "over-2-5",
    collectionTitle: "Over 2.5 Goals",
    marketFilter: "goals",
  },
  {
    value: "winEitherYes",
    label: "Win Either Half: Yes",
    slug: "win-either-half",
    collectionTitle: "Win Either Half",
    marketFilter: "winEitherHalf",
  },
];

export function quickFilterOptionBySlug(slug: string): QuickFilterOption | undefined {
  return QUICK_FILTER_OPTIONS.find((option) => option.slug === slug);
}

export function matchesQuickFilter(prediction: Prediction, filter: QuickFilter): boolean {
  const m = prediction.markets;
  switch (filter) {
    case QUICK_FILTER_NONE:
      return true;
    case "cornersO7_5Yes":
      return m.corners.over7_5;
    case "halfDrawYes":
      return m.firstHalfOutcome.code === "X";
    case "over1_5Yes":
      return m.goals.over1_5;
    case "over2_5Yes":
      return m.goals.over2_5;
    case "winEitherYes":
      return winEitherHalfCode(m) !== null;
  }
}
