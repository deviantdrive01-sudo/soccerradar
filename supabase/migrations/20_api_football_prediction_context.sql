-- API-Football's fixture id, once resolved for a prediction (see
-- lib/api-football-context.ts) — null when the league isn't curated
-- (leagues.use_api_football) or no confident match was found. Also doubles
-- as the marker for "this fixture was discovered via API-Football" when
-- match_id has the af-<id> prefix (see scripts/crawl-fixtures.ts).
alter table predictions add column if not exists api_football_fixture_id integer;

-- Trimmed API-Football /predictions payload actually sent to Claude as
-- extra context, persisted verbatim alongside the prediction it informed —
-- same reasoning as the existing h2h column (12_h2h_meetings.sql): shows
-- the real data a prediction was based on, and lays groundwork for a future
-- "backed by live match data" UI without a further migration. Null
-- whenever api_football_fixture_id is null.
alter table predictions add column if not exists api_football_context jsonb;
