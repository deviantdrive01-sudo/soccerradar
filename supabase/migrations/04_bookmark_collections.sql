-- SoccerRadar: named, shareable bookmark collections

create table if not exists bookmark_collections (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists bookmark_collections_set_updated_at on bookmark_collections;
create trigger bookmark_collections_set_updated_at
  before update on bookmark_collections
  for each row execute function set_updated_at(); -- reuses the function defined in 01_init.sql

create table if not exists bookmark_collection_items (
  id bigint generated always as identity primary key,
  collection_id bigint not null references bookmark_collections(id) on delete cascade,
  prediction_id bigint not null references predictions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, prediction_id)
);

alter table bookmark_collections enable row level security;
alter table bookmark_collection_items enable row level security;

-- Public select on both: a shared collection link must work for logged-out
-- visitors. Writes are owner-only.
drop policy if exists "bookmark_collections are publicly readable" on bookmark_collections;
create policy "bookmark_collections are publicly readable"
  on bookmark_collections for select
  using (true);

drop policy if exists "users manage their own collections" on bookmark_collections;
create policy "users manage their own collections"
  on bookmark_collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bookmark_collection_items are publicly readable" on bookmark_collection_items;
create policy "bookmark_collection_items are publicly readable"
  on bookmark_collection_items for select
  using (true);

drop policy if exists "users manage items in their own collections" on bookmark_collection_items;
create policy "users manage items in their own collections"
  on bookmark_collection_items for all
  using (
    exists (select 1 from bookmark_collections c where c.id = collection_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from bookmark_collections c where c.id = collection_id and c.user_id = auth.uid())
  );
