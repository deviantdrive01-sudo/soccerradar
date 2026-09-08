create table if not exists team_crests (
  team_name text primary key,
  data_uri text not null,
  updated_at timestamptz not null default now()
);

alter table team_crests enable row level security;

-- Crests are non-sensitive, meant to be publicly rendered — readable by
-- anyone. Writes only ever happen through the service-role client
-- (lib/team-crest.ts caches a resolved crest after its first API-Football
-- lookup), same "public read, service-role write" split as leagues/predictions.
create policy "team crests are public to read"
  on team_crests for select using (true);
