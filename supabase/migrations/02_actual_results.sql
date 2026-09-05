-- Actual match results, recorded after full time to compare against predictions.
alter table predictions add column if not exists actual_result jsonb;
