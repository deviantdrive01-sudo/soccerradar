-- SoccerRadar: admin backend support (league Flashscore links, ad settings/events)

alter table leagues add column if not exists flashscore_slug text;

create table if not exists ad_settings (
  id smallint primary key default 1 check (id = 1),
  house_weight integer not null default 50 check (house_weight between 0 and 100),
  google_enabled boolean not null default true,
  house_video_path text not null default '/ads/placeholder-ad.mp4',
  house_click_url text not null default 'https://getordara.com',
  updated_at timestamptz not null default now()
);

insert into ad_settings (id) values (1) on conflict (id) do nothing;

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

drop trigger if exists ad_settings_set_updated_at on ad_settings;
create trigger ad_settings_set_updated_at
  before update on ad_settings
  for each row
  execute function set_updated_at();

create table if not exists ad_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('impression', 'click')),
  created_at timestamptz not null default now()
);

create index if not exists ad_events_created_at_idx on ad_events (created_at);

-- ad_settings: publicly readable (every visitor's AdSlot reads it), writes via service role only.
alter table ad_settings enable row level security;

drop policy if exists "ad_settings are publicly readable" on ad_settings;
create policy "ad_settings are publicly readable"
  on ad_settings for select
  using (true);

-- ad_events: no public policies at all. Both the write path (app/api/ad-events)
-- and the read path (admin dashboard) go through the service-role admin client.
alter table ad_events enable row level security;
