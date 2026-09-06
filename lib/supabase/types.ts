import type { ActualResult, HydratedMarkets } from "@/lib/hydrate";

export interface League {
  id: number;
  name: string;
  country: string;
  api_league_id: number;
  is_active: boolean;
  flashscore_slug: string | null;
  created_at: string;
}

export interface AdSettings {
  id: number;
  house_weight: number;
  google_enabled: boolean;
  house_video_path: string;
  house_click_url: string;
  updated_at: string;
}

export type AdEventType = "impression" | "click";

export interface AdEvent {
  id: number;
  event_type: AdEventType;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface FavoriteCountry {
  id: number;
  user_id: string;
  country: string;
  created_at: string;
}

export interface FavoriteLeague {
  id: number;
  user_id: string;
  league_id: number;
  created_at: string;
}

export interface FavoriteMatch {
  id: number;
  user_id: string;
  prediction_id: number;
  created_at: string;
}

export interface BookmarkCollection {
  id: number;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface BookmarkCollectionItem {
  id: number;
  collection_id: number;
  prediction_id: number;
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
      ad_settings: {
        Row: Row<AdSettings>;
        Insert: Row<Partial<Omit<AdSettings, "updated_at">>>;
        Update: Row<Partial<Omit<AdSettings, "id" | "updated_at">>>;
        Relationships: [];
      };
      ad_events: {
        Row: Row<AdEvent>;
        Insert: Row<Omit<AdEvent, "id" | "created_at"> & { id?: number }>;
        Update: Row<Partial<Omit<AdEvent, "id">>>;
        Relationships: [];
      };
      profiles: {
        Row: Row<Profile>;
        Insert: Row<Partial<Omit<Profile, "created_at">> & { id: string }>;
        Update: Row<Partial<Omit<Profile, "id" | "created_at">>>;
        Relationships: [];
      };
      favorite_countries: {
        Row: Row<FavoriteCountry>;
        Insert: Row<Omit<FavoriteCountry, "id" | "created_at"> & { id?: number }>;
        Update: Row<Partial<Omit<FavoriteCountry, "id">>>;
        Relationships: [];
      };
      favorite_leagues: {
        Row: Row<FavoriteLeague>;
        Insert: Row<Omit<FavoriteLeague, "id" | "created_at"> & { id?: number }>;
        Update: Row<Partial<Omit<FavoriteLeague, "id">>>;
        Relationships: [];
      };
      favorite_matches: {
        Row: Row<FavoriteMatch>;
        Insert: Row<Omit<FavoriteMatch, "id" | "created_at"> & { id?: number }>;
        Update: Row<Partial<Omit<FavoriteMatch, "id">>>;
        Relationships: [];
      };
      bookmark_collections: {
        Row: Row<BookmarkCollection>;
        Insert: Row<Omit<BookmarkCollection, "id" | "created_at" | "updated_at"> & { id?: number }>;
        Update: Row<Partial<Omit<BookmarkCollection, "id" | "created_at">>>;
        Relationships: [];
      };
      bookmark_collection_items: {
        Row: Row<BookmarkCollectionItem>;
        Insert: Row<Omit<BookmarkCollectionItem, "id" | "created_at"> & { id?: number }>;
        Update: Row<Partial<Omit<BookmarkCollectionItem, "id">>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
