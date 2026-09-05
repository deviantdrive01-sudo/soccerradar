-- SoccerRadar: initial schema + seed data (16 top global leagues)

create table if not exists leagues (
  id bigint generated always as identity primary key,
  name text not null,
  country text not null,
  api_league_id integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists predictions (
  id bigint generated always as identity primary key,
  league_id bigint not null references leagues (id) on delete cascade,
  match_id integer not null unique,
  home_team text not null,
  away_team text not null,
  match_date timestamptz not null,
  markets jsonb not null default '{}'::jsonb,
  confidence integer not null check (confidence between 0 and 100),
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists predictions_league_id_idx on predictions (league_id);
create index if not exists predictions_match_date_idx on predictions (match_date);

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists predictions_set_updated_at on predictions;
create trigger predictions_set_updated_at
  before update on predictions
  for each row
  execute function set_updated_at();

-- Row Level Security: public read-only, writes via service role only.
alter table leagues enable row level security;
alter table predictions enable row level security;

drop policy if exists "leagues are publicly readable" on leagues;
create policy "leagues are publicly readable"
  on leagues for select
  using (true);

drop policy if exists "predictions are publicly readable" on predictions;
create policy "predictions are publicly readable"
  on predictions for select
  using (true);

-- Seed: 16 top global leagues (API-Football league IDs)
insert into leagues (name, country, api_league_id, is_active) values
  ('Premier League',        'England',     39,  true),
  ('La Liga',                'Spain',       140, true),
  ('Serie A',                'Italy',       135, true),
  ('Bundesliga',             'Germany',     78,  true),
  ('Ligue 1',                'France',      61,  true),
  ('Liga Portugal',          'Portugal',    94,  true),
  ('Eredivisie',             'Netherlands', 88,  true),
  ('Pro League',             'Belgium',     144, true),
  ('Super Lig',              'Turkey',      203, true),
  ('Scottish Premiership',   'Scotland',    179, true),
  ('2. Bundesliga',          'Germany',     79,  true),
  ('Superliga',              'Denmark',     119, true),
  ('Saudi Pro League',       'Saudi Arabia',307, true),
  ('MLS',                    'USA',         253, true),
  ('Super League',           'Switzerland', 207, true),
  ('Superliga',              'Romania',     283, true),
  ('Brasileirão Série A',    'Brazil',      71,  true),
  ('Liga Profesional Argentina', 'Argentina', 128, true),
  ('Primera Nacional',       'Argentina',   129, true),
  ('Brasileiro Série B',     'Brazil',      72,  true)
on conflict (api_league_id) do update
  set name = excluded.name,
      country = excluded.country,
      is_active = excluded.is_active;
