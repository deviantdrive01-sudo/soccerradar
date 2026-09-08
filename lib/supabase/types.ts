import type { ActualResult, HydratedMarkets, MarketKey } from "@/lib/hydrate";

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

export interface SiteSettings {
  id: number;
  profile_banner_mobile_url: string | null;
  profile_banner_desktop_url: string | null;
  updated_at: string;
}

export type AdEventType = "impression" | "click";

export interface AdEvent {
  id: number;
  event_type: AdEventType;
  created_at: string;
}

export type ProfileRole = "user" | "admin" | "super_admin";

export interface Profile {
  id: string;
  username: string | null;
  role: ProfileRole;
  avatar_url: string | null;
  phone: string | null;
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

export interface Booking {
  id: number;
  user_id: string;
  title: string;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingItem {
  id: number;
  booking_id: number;
  prediction_id: number;
  market_key: MarketKey;
  /** The user's own call for this market, when it diverges from SoccerRadar's prediction. Null = no override. */
  user_value: string | null;
  created_at: string;
}

/**
 * One row per website user, tracking their Telegram bot link. link_code/
 * code_expires_at hold a pending, short-lived linking code; chat_id/
 * linked_at are set once the bot confirms it. See supabase/migrations/
 * 15_telegram_links.sql.
 */
export interface TelegramLink {
  id: string;
  user_id: string;
  chat_id: number | null;
  link_code: string | null;
  code_expires_at: string | null;
  linked_at: string | null;
  created_at: string;
}

/**
 * One row per scheduled Telegram broadcast actually sent — idempotency +
 * audit trail so a re-run (retry, manual workflow_dispatch) doesn't double-
 * post. `detail` holds a per-post identifier (a booking id, a prediction id,
 * or "daily" for the single-shot categories) so match-level categories can
 * post every qualifying match today while skipping ones already sent. See
 * supabase/migrations/16_scheduled_broadcasts.sql.
 */
export interface TelegramBroadcastLog {
  id: string;
  category: string;
  broadcast_date: string;
  detail: string | null;
  created_at: string;
}

/** One past meeting between these two exact teams, scraped from its own Flashscore match page. */
export interface H2hMeeting {
  date: string;
  competition: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  corners: { home: number; away: number } | null;
  /** Absent on meetings scraped before this was added — null when scraped but unavailable for that match. */
  htCorners?: { home: number; away: number } | null;
}

export interface Prediction {
  id: number;
  league_id: number;
  match_id: string;
  home_team: string;
  away_team: string;
  match_date: string;
  /** Null until scripts/generate-predictions.ts fills it in — a bare fixture
   * inserted by scripts/crawl-fixtures.ts starts with no prediction yet. */
  markets: HydratedMarkets | null;
  confidence: number | null;
  summary: string | null;
  /** Last up-to-3 meetings the prediction was based on. Null for predictions
   * generated before this was persisted, or when no H2H history existed. */
  h2h: H2hMeeting[] | null;
  actual_result: ActualResult | null;
  /** Admin-toggled — surfaces this match in the "Top Match" scheduled Telegram broadcast. */
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A row is "pending" (crawled, not yet predicted) iff markets is null — the
 * three fields are always set together, never partially. Use this instead of
 * checking each field separately so TypeScript narrows all three at once.
 */
export function isPredicted(
  p: Prediction,
): p is Prediction & { markets: HydratedMarkets; confidence: number; summary: string } {
  return p.markets !== null;
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
          Omit<Prediction, "id" | "created_at" | "updated_at" | "actual_result" | "markets" | "confidence" | "summary" | "h2h" | "is_featured"> & {
            id?: number;
            // Optional so upserts that omit it (e.g. the weekly cron re-fetching a
            // fixture) don't clobber an actual_result already recorded for that match.
            actual_result?: ActualResult | null;
            // Optional — scripts/crawl-fixtures.ts inserts bare rows with none of
            // these yet; scripts/generate-predictions.ts fills them in later via update.
            markets?: HydratedMarkets | null;
            confidence?: number | null;
            summary?: string | null;
            h2h?: H2hMeeting[] | null;
            // Optional — defaults to false in the DB; nothing inserts a featured row directly.
            is_featured?: boolean;
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
      site_settings: {
        Row: Row<SiteSettings>;
        Insert: Row<Partial<Omit<SiteSettings, "updated_at">>>;
        Update: Row<Partial<Omit<SiteSettings, "id" | "updated_at">>>;
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
      bookings: {
        Row: Row<Booking>;
        Insert: Row<
          Omit<Booking, "id" | "created_at" | "updated_at" | "is_public" | "published_at"> & {
            id?: number;
            is_public?: boolean;
            published_at?: string | null;
          }
        >;
        Update: Row<Partial<Omit<Booking, "id" | "created_at">>>;
        Relationships: [];
      };
      booking_items: {
        Row: Row<BookingItem>;
        Insert: Row<Omit<BookingItem, "id" | "created_at" | "user_value"> & { id?: number; user_value?: string | null }>;
        Update: Row<Partial<Omit<BookingItem, "id">>>;
        Relationships: [];
      };
      telegram_links: {
        Row: Row<TelegramLink>;
        Insert: Row<
          Omit<TelegramLink, "id" | "created_at" | "chat_id" | "link_code" | "code_expires_at" | "linked_at"> & {
            id?: string;
            chat_id?: number | null;
            link_code?: string | null;
            code_expires_at?: string | null;
            linked_at?: string | null;
          }
        >;
        Update: Row<Partial<Omit<TelegramLink, "id" | "user_id" | "created_at">>>;
        Relationships: [];
      };
      telegram_broadcast_log: {
        Row: Row<TelegramBroadcastLog>;
        Insert: Row<Omit<TelegramBroadcastLog, "id" | "created_at" | "detail"> & { id?: string; detail?: string | null }>;
        Update: Row<Partial<Omit<TelegramBroadcastLog, "id" | "created_at">>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
