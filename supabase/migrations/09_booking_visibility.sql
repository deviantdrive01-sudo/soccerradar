-- Public/private opt-in for the Top Bookings directory. Every booking is
-- already accessible via its direct link regardless of this flag (bookings
-- are `select using (true)`, unchanged here) — is_public only controls
-- whether a booking is *listed* on /top-bookings.
alter table bookings add column if not exists is_public boolean not null default false;
alter table bookings add column if not exists published_at timestamptz;

-- Drives the Top Bookings directory's default (recency) sort without a
-- full-table scan as public bookings grow.
create index if not exists bookings_public_published_idx
  on bookings (published_at desc) where is_public = true;
