-- Passport stamp -> stop page: remember which bus stop each trip ended at
-- Run this once in the Supabase dashboard AFTER passport.sql: SQL Editor -> New query -> paste -> Run
-- Safe to run again: the column is only added if it is missing
-- New trips save the stop code (home.vue and GroupLobby.vue saveTrip). Older rows stay null, and the
-- passport matches their end_stop name against /api/allBusStops instead.


-- 1. The end stop's 5-digit bus stop code (text, so leading zeros like '01012' are kept)
alter table public.passport_entries add column if not exists end_stop_code text;
