alter table predictions add column if not exists is_featured boolean not null default false;

create table if not exists telegram_broadcast_log (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  broadcast_date date not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table telegram_broadcast_log enable row level security;
-- No client policies: only ever written by the admin/service-role client
-- (the scheduled broadcast routes and the admin matches page), same as
-- how leagues/predictions writes work.
