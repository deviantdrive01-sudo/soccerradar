-- Storage bucket for downloadable-image template backgrounds (Match Day,
-- League Matches, Outcomes/Best Picks) — same "public bucket, admin/service-
-- role writes only" shape as the existing avatars bucket.
insert into storage.buckets (id, name, public)
values ('template-media', 'template-media', true)
on conflict (id) do nothing;

create policy "template media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'template-media');

-- Per-template style settings. id is a fixed slug, not an auto-increment —
-- there are only ever exactly the rows the app knows about (currently
-- 'match_day' | 'league_matches' | 'best_picks').
create table if not exists template_settings (
  id text primary key,
  background_url text not null,
  accent_color text not null default '#F1FF3B',
  wordmark_text text not null,
  updated_at timestamptz not null default now()
);

alter table template_settings enable row level security;

create policy "template settings are publicly readable"
  on template_settings for select using (true);
-- No insert/update policy — only ever written by the service-role client
-- (the new /admin/templates page), same split as leagues/predictions.
