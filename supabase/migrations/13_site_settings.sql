-- SoccerRadar: general site-wide admin-managed content, starting with the
-- /account section's promo banner. Separate from ad_settings (that table is
-- specifically ad-serving config, not general site content).

create table if not exists site_settings (
  id smallint primary key default 1 check (id = 1),
  profile_banner_mobile_url text,
  profile_banner_desktop_url text,
  updated_at timestamptz not null default now()
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists site_settings_set_updated_at on site_settings;
create trigger site_settings_set_updated_at
  before update on site_settings
  for each row
  execute function set_updated_at();

-- Publicly readable (every /account/* visitor renders the banner), writes via service role only.
alter table site_settings enable row level security;

drop policy if exists "site_settings are publicly readable" on site_settings;
create policy "site_settings are publicly readable"
  on site_settings for select
  using (true);
