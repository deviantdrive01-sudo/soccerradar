-- Shadow stat-only prediction engine (lib/stat-engine.ts) — a deterministic
-- Poisson-based second engine, run alongside Claude for comparison via
-- scripts/generate-stat-predictions.ts + scripts/compare-engines.ts.
-- Deliberately a separate table, not a column on `predictions`: the live
-- site still reads 100% Claude-sourced markets from `predictions.markets`,
-- unaffected by anything in this table.
create table if not exists stat_predictions (
  id bigserial primary key,
  prediction_id integer not null references predictions(id) on delete cascade unique,
  markets jsonb not null,
  confidence integer not null,
  -- Debug/audit trail: the lambdas, h2h corner/shot averages, and sample
  -- size that produced this call — lets a given prediction's "why" be
  -- inspected without recomputing it.
  inputs jsonb,
  generated_at timestamptz not null default now()
);
