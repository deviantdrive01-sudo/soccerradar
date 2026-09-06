-- predictions.match_id was integer-only, sized for API-Football's numeric
-- fixture IDs. The Flashscore-based prediction pipeline identifies fixtures
-- by Flashscore's alphanumeric match IDs (e.g. "EVN6T9mf") instead, so this
-- column needs to hold either. match_id is purely internal plumbing (the
-- upsert conflict key, and the id Claude echoes back to reconcile its
-- response to a fixture) — nothing else references it as a foreign key, so
-- widening it to text is safe.
alter table predictions alter column match_id type text using match_id::text;
