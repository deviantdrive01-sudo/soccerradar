-- Rename "booker"/"booker_items" (05_bookers.sql) to "bookings"/"booking_items".
-- Postgres updates dependent policies/constraints/triggers automatically when
-- the underlying table/column is renamed (it tracks dependencies by OID, not
-- by name), so this is safe without recreating any of that.

alter table bookers rename to bookings;
alter table booker_items rename to booking_items;
alter table booking_items rename column booker_id to booking_id;

alter trigger bookers_set_updated_at on bookings rename to bookings_set_updated_at;

alter policy "bookers are publicly readable" on bookings rename to "bookings are publicly readable";
alter policy "users manage their own bookers" on bookings rename to "users manage their own bookings";
alter policy "booker_items are publicly readable" on booking_items rename to "booking_items are publicly readable";
alter policy "users manage items in their own bookers" on booking_items rename to "users manage items in their own bookings";
