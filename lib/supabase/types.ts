import type { ActualResult, HydratedMarkets, MarketKey } from "@/lib/hydrate";

export interface League {
  id: number;
  name: string;
  country: string;
  api_league_id: number;
  is_active: boolean;
  flashscore_slug: string | null;
  /** Opt-in to API-Football as an extra data source (fixture discovery fallback + Claude prediction context) — see lib/api-football-context.ts. */
  use_api_football: boolean;
  created_at: string;
}

/**
 * Trimmed shape of API-Football's /predictions response actually sent to
 * Claude as extra context — see lib/api-football-context.ts, which builds
 * this from the raw API response.
 */
export interface ApiFootballPredictionContext {
  winnerComment: string | null;
  advice: string | null;
  percent: { home: string; draw: string; away: string };
  comparison: {
    form: { home: string; away: string };
    att: { home: string; away: string };
    def: { home: string; away: string };
    poissonDistribution: { home: string; away: string };
    h2h: { home: string; away: string };
    goals: { home: string; away: string };
    total: { home: string; away: string };
  } | null;
  teams: {
    home: ApiFootballTeamSummary;
    away: ApiFootballTeamSummary;
  };
  h2h: ApiFootballH2hMeeting[];
}

export interface ApiFootballTeamSummary {
  last5Form: string | null;
  seasonForm: string | null;
  goalsForAvg: number | null;
  goalsAgainstAvg: number | null;
  cleanSheetPct: number | null;
  failedToScorePct: number | null;
}

export interface ApiFootballH2hMeeting {
  fixtureId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Real "Total Shots" from this meeting's own /fixtures/statistics, when that fixture had stats coverage — see lib/api-football-context.ts's fetchH2hShots. */
  totalShots?: { home: number; away: number } | null;
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

/**
 * Per-template style config for the downloadable-image templates (Match
 * Day, League Matches, Outcomes/Best Picks) — admin-editable from
 * /admin/templates. id is a fixed slug (TemplateId in lib/template-settings.ts),
 * not an auto-increment. See supabase/migrations/18_template_settings.sql.
 */
export interface TemplateSettingsRow {
  id: string;
  background_url: string;
  accent_color: string;
  wordmark_text: string;
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

/**
 * A team's crest, cached after its first API-Football lookup (lib/team-crest.ts)
 * so every later render reuses this row instead of hitting the API again —
 * `data_uri` is the already-inlined base64 image, ready to drop straight into
 * a Satori render with no further fetch. See supabase/migrations/17_team_crests.sql.
 */
export interface TeamCrest {
  team_name: string;
  data_uri: string;
  updated_at: string;
}

/**
 * A fixture fetched from API-Sports, archived so the Match Streak engine's
 * team-form/head-to-head lookups can query our own data instead of
 * re-hitting the provider on every visit — see lib/sports/football.ts and
 * supabase/migrations/21_sport_fixture_archive.sql. Live/scheduled rows get
 * overwritten as their status/score changes; a finished row is effectively
 * permanent.
 */
export interface SportFixtureRow {
  id: string;
  sport: string;
  competition_id: number;
  competition_name: string;
  competition_country: string | null;
  competition_logo: string | null;
  kickoff: string;
  status_state: string;
  status_label: string;
  status_clock: string | null;
  home_team_id: number;
  home_team_name: string;
  home_team_logo: string | null;
  home_score: number | null;
  home_ht_score: number | null;
  away_team_id: number;
  away_team_name: string;
  away_team_logo: string | null;
  away_score: number | null;
  away_ht_score: number | null;
  updated_at: string;
}

/** Per-fixture shots/corners/cards, populated once from /fixtures/statistics after a match finishes — immutable from that point on. */
export interface FixtureStatsRow {
  fixture_id: string;
  home_shots: number | null;
  away_shots: number | null;
  home_corners: number | null;
  away_corners: number | null;
  home_cards: number | null;
  away_cards: number | null;
  fetched_at: string;
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
  /** Combined yellow + red cards per side — display-only, absent on meetings scraped before this was added. */
  cards?: { home: number; away: number } | null;
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
  /** API-Football's fixture id, once resolved — null when the league isn't curated (leagues.use_api_football) or no confident match was found. Also present (as the id embedded in match_id) when this fixture was discovered via API-Football rather than Flashscore — see scripts/crawl-fixtures.ts. */
  api_football_fixture_id: number | null;
  /** Trimmed API-Football /predictions payload sent to Claude as extra context — see lib/api-football-context.ts. Null whenever api_football_fixture_id is null. */
  api_football_context: ApiFootballPredictionContext | null;
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
          Omit<
            Prediction,
            | "id"
            | "created_at"
            | "updated_at"
            | "actual_result"
            | "markets"
            | "confidence"
            | "summary"
            | "h2h"
            | "is_featured"
            | "api_football_fixture_id"
            | "api_football_context"
          > & {
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
            // Optional — filled in later by scripts/generate-predictions.ts, same as markets/confidence/summary.
            api_football_fixture_id?: number | null;
            api_football_context?: ApiFootballPredictionContext | null;
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
      team_crests: {
        Row: Row<TeamCrest>;
        Insert: Row<Omit<TeamCrest, "updated_at"> & { updated_at?: string }>;
        Update: Row<Partial<TeamCrest>>;
        Relationships: [];
      };
      sport_fixtures: {
        Row: Row<SportFixtureRow>;
        Insert: Row<Omit<SportFixtureRow, "updated_at"> & { updated_at?: string }>;
        Update: Row<Partial<SportFixtureRow>>;
        Relationships: [];
      };
      fixture_stats: {
        Row: Row<FixtureStatsRow>;
        Insert: Row<Omit<FixtureStatsRow, "fetched_at"> & { fetched_at?: string }>;
        Update: Row<Partial<FixtureStatsRow>>;
        Relationships: [];
      };
      template_settings: {
        Row: Row<TemplateSettingsRow>;
        Insert: Row<Omit<TemplateSettingsRow, "updated_at"> & { updated_at?: string }>;
        Update: Row<Partial<Omit<TemplateSettingsRow, "id">>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
