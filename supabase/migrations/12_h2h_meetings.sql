-- Head-to-head meeting history, scraped once during prediction generation
-- (scripts/generate-predictions.ts) and persisted so the match detail page
-- can show users the same raw data the prediction was based on, rather than
-- asking them to trust the "sum" text alone.
alter table predictions add column if not exists h2h jsonb;
