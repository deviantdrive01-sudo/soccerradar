import type { ActualResult, HydratedMarkets } from "@/lib/hydrate";

export interface League {
  id: number;
  name: string;
  country: string;
  api_league_id: number;
  is_active: boolean;
  created_at: string;
}

export interface Prediction {
  id: number;
  league_id: number;
  match_id: number;
  home_team: string;
  away_team: string;
  match_date: string;
  markets: HydratedMarkets;
  confidence: number;
  summary: string;
  actual_result: ActualResult | null;
  created_at: string;
  updated_at: string;
}

/**
 * Postgrest's generic client types require every Row/Insert/Update to
 * structurally satisfy `Record<string, unknown>` (an explicit index
 * signature). Plain interfaces don't have one, so intersecting with
 * `Record<string, unknown>` here keeps the precise field types while
 * still matching the constraint — otherwise the whole schema silently
 * collapses to `never` and every query result loses its type.
 */
type Row<T> = T & Record<string, unknown>;

export interface Database {
  public: {
    Tables: {
      leagues: {
        Row: Row<League>;
        Insert: Row<Omit<League, "id" | "created_at"> & { id?: number }>;
        Update: Row<Partial<Omit<League, "id">>>;
        Relationships: [];
      };
      predictions: {
        Row: Row<Prediction>;
        Insert: Row<
          Omit<Prediction, "id" | "created_at" | "updated_at" | "actual_result"> & {
            id?: number;
            // Optional so upserts that omit it (e.g. the weekly cron re-fetching a
            // fixture) don't clobber an actual_result already recorded for that match.
            actual_result?: ActualResult | null;
          }
        >;
        Update: Row<Partial<Omit<Prediction, "id">>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
