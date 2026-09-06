-- SoccerRadar: "bookers" — per-market pick slips (separate from bookmark collections)

create table if not exists bookers (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists bookers_set_updated_at on bookers;
create trigger bookers_set_updated_at
  before update on bookers
  for each row execute function set_updated_at(); -- reuses the function defined in 01_init.sql

create table if not exists booker_items (
  id bigint generated always as identity primary key,
  booker_id bigint not null references bookers(id) on delete cascade,
  prediction_id bigint not null references predictions(id) on delete cascade,
  market_key text not null,
  created_at timestamptz not null default now(),
  unique (booker_id, prediction_id, market_key)
);

alter table bookers enable row level security;
alter table booker_items enable row level security;

-- Same shape as bookmark_collections/bookmark_collection_items: public
-- select (shareable link), owner-only write.
drop policy if exists "bookers are publicly readable" on bookers;
create policy "bookers are publicly readable"
  on bookers for select
  using (true);

drop policy if exists "users manage their own bookers" on bookers;
create policy "users manage their own bookers"
  on bookers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "booker_items are publicly readable" on booker_items;
create policy "booker_items are publicly readable"
  on booker_items for select
  using (true);

drop policy if exists "users manage items in their own bookers" on booker_items;
create policy "users manage items in their own bookers"
  on booker_items for all
  using (
    exists (select 1 from bookers b where b.id = booker_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from bookers b where b.id = booker_id and b.user_id = auth.uid())
  );
