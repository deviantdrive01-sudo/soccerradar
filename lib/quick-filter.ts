import { isDrawOrOver2_5, isFullTimeDraw, winEitherHalfCode } from "@/lib/hydrate";
import type { MarketFilter } from "@/components/market-filter";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const QUICK_FILTER_NONE = "none";

export type QuickFilter =
  | typeof QUICK_FILTER_NONE
  | "cornersO7_5Yes"
  | "halfDrawYes"
  | "over1_5Yes"
  | "over2_5Yes"
  | "winEitherYes"
  | "ftDrawYes"
  | "drawOrOverYes";

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
  /** The exact single market this collection represents — lets a booking pick be added with no extra selection step. */
  marketKey: MarketKey;
}

export const QUICK_FILTER_OPTIONS: QuickFilterOption[] = [
  {
    value: "cornersO7_5Yes",
    label: "Corners O7.5: Yes",
    slug: "corners-over-7-5",
    collectionTitle: "Corners Over 7.5",
    marketFilter: "corners",
    marketKey: "over7_5",
  },
  {
    value: "halfDrawYes",
    label: "Half Draw: Yes",
    slug: "half-draw",
    collectionTitle: "Half Time",
    marketFilter: "ftDraw",
    marketKey: "firstHalfOutcome",
  },
  {
    value: "over1_5Yes",
    label: "Over 1.5: Yes",
    slug: "over-1-5",
    collectionTitle: "Over 1.5 Goals",
    marketFilter: "goals",
    marketKey: "over1_5",
  },
  {
    value: "over2_5Yes",
    label: "Over 2.5: Yes",
    slug: "over-2-5",
    collectionTitle: "Over 2.5 Goals",
    marketFilter: "goals",
    marketKey: "over2_5",
  },
  {
    value: "winEitherYes",
    label: "Win Either Half: Yes",
    slug: "win-either-half",
    collectionTitle: "Win Either Half",
    marketFilter: "winEitherHalf",
    marketKey: "winEitherHalf",
  },
  {
    value: "ftDrawYes",
    label: "FT Draw: Yes",
    slug: "ft-draw",
    collectionTitle: "FT Draw",
    marketFilter: "ftDraw",
    marketKey: "fullTimeDraw",
  },
  {
    value: "drawOrOverYes",
    label: "Draw/O2.5: Yes",
    slug: "draw-or-over-2-5",
    collectionTitle: "Draw or Over 2.5",
    marketFilter: "drawOrOver",
    marketKey: "drawOrOver2_5",
  },
];

export function quickFilterOptionBySlug(slug: string): QuickFilterOption | undefined {
  return QUICK_FILTER_OPTIONS.find((option) => option.slug === slug);
}

export function matchesQuickFilter(prediction: Prediction, filter: QuickFilter): boolean {
  if (filter === QUICK_FILTER_NONE) return true;
  const m = prediction.markets;
  if (!m) return false; // no prediction yet — can't match any specific market filter
  switch (filter) {
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
    case "ftDrawYes":
      return isFullTimeDraw(m);
    case "drawOrOverYes":
      return isDrawOrOver2_5(m);
  }
}
