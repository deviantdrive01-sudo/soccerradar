-- Per-league opt-in for using API-Football as an extra data source (fixture
-- discovery fallback + Claude prediction context) — off by default, curated
-- in manually from /admin/leagues one league at a time. Not derived from
-- api_league_id being "real" (non-synthetic), since a real id doesn't
-- guarantee current-season match-statistics coverage on API-Football's end.
alter table leagues add column if not exists use_api_football boolean not null default false;
