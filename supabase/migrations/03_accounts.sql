-- SoccerRadar: public user accounts (profiles + favorites)

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row for every new auth user, pulling username from
-- the signup metadata (supabase.auth.signUp({ options: { data: { username } } })).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table profiles enable row level security;

drop policy if exists "profiles are publicly readable" on profiles;
create policy "profiles are publicly readable"
  on profiles for select
  using (true);

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Three focused tables rather than one polymorphic one — avoids nullable
-- columns breaking a unique constraint, and keeps RLS simple per type.
create table if not exists favorite_countries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null,
  created_at timestamptz not null default now(),
  unique (user_id, country)
);

create table if not exists favorite_leagues (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id bigint not null references leagues(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, league_id)
);

create table if not exists favorite_matches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction_id bigint not null references predictions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, prediction_id)
);

alter table favorite_countries enable row level security;
alter table favorite_leagues enable row level security;
alter table favorite_matches enable row level security;

drop policy if exists "users manage their own favorite countries" on favorite_countries;
create policy "users manage their own favorite countries"
  on favorite_countries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage their own favorite leagues" on favorite_leagues;
create policy "users manage their own favorite leagues"
  on favorite_leagues for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage their own favorite matches" on favorite_matches;
create policy "users manage their own favorite matches"
  on favorite_matches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
