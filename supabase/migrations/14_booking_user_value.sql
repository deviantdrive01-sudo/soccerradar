-- Lets a booking pick diverge from SoccerRadar's own call for that market —
-- e.g. the AI says Corners Over 7.5: No, but the user wants to book Yes.
-- NULL means "no override", i.e. today's behavior: the pick just tracks
-- whatever SoccerRadar predicted for that market.
alter table booking_items add column if not exists user_value text;
