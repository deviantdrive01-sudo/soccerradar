-- Durable archive of fixtures fetched from API-Sports (football today,
-- basketball once it's keyed) — lets team-form/head-to-head lookups for the
-- Match Streak engine query our own data instead of re-hitting the
-- provider's API on every visit. A finished fixture's own result/stats
-- never change, so once archived a row is effectively permanent; live/
-- scheduled fixtures get overwritten in place as their status/score updates.
create table if not exists sport_fixtures (
  id text primary key, -- '${sport}:${providerFixtureId}'
  sport text not null,
  competition_id integer not null,
  competition_name text not null,
  competition_country text,
  competition_logo text,
  kickoff timestamptz not null,
  status_state text not null, -- scheduled | live | finished | postponed | cancelled
  status_label text not null,
  status_clock text,
  home_team_id integer not null,
  home_team_name text not null,
  home_team_logo text,
  home_score integer,
  home_ht_score integer,
  away_team_id integer not null,
  away_team_name text not null,
  away_team_logo text,
  away_score integer,
  away_ht_score integer,
  updated_at timestamptz not null default now()
);

create index if not exists sport_fixtures_home_team_idx on sport_fixtures (sport, home_team_id, kickoff desc);
create index if not exists sport_fixtures_away_team_idx on sport_fixtures (sport, away_team_id, kickoff desc);

alter table sport_fixtures enable row level security;

-- Public, non-sensitive fixture data — readable by anyone. Writes only ever
-- happen through the service-role client (lib/sports/football.ts archives a
-- fixture after fetching it from the live API), same "public read,
-- service-role write" split as team_crests.
create policy "sport fixtures are public to read"
  on sport_fixtures for select using (true);

-- Per-fixture shots/corners/cards, populated once from /fixtures/statistics
-- after a match finishes — immutable from that point on.
create table if not exists fixture_stats (
  fixture_id text primary key references sport_fixtures(id) on delete cascade,
  home_shots integer,
  away_shots integer,
  home_corners integer,
  away_corners integer,
  home_cards integer,
  away_cards integer,
  fetched_at timestamptz not null default now()
);

alter table fixture_stats enable row level security;

create policy "fixture stats are public to read"
  on fixture_stats for select using (true);
