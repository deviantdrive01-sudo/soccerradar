-- Allow a fixture to exist with no prediction yet ("crawled, not yet
-- predicted"). markets/confidence/summary are always null together (pending)
-- or all present together (predicted) — never partial; lib/supabase/types.ts's
-- isPredicted() type guard is the single place that checks this.
alter table predictions alter column markets drop not null;
alter table predictions alter column markets drop default;
alter table predictions alter column confidence drop not null;
alter table predictions alter column summary drop not null;
alter table predictions alter column summary drop default;
