-- One-off fix: make room for the feature 3 tables in stop_activities.sql
-- Run this once in the Supabase dashboard BEFORE stop_activities.sql: SQL Editor -> New query -> paste -> Run
--
-- Why: the live database still has the challenges / challenge_completions tables made for the
-- yijun/stop-logs branch (uuid ids, stop_id, no lat/lon, completed_at). The current /stop/:code page
-- needs the shape in stop_activities.sql instead, and "create table if not exists" skips a table that
-- already exists, so stop_activities.sql fails on the old one.
-- Nothing is deleted: the old tables (and their rows and policies) are renamed to *_old.
-- stop_logs is left alone.


-- 1. Rename the old tables, only if they still have the old shape (so running this twice is harmless)
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'challenge_completions' and column_name = 'completed_at') then
        alter table public.challenge_completions rename to challenge_completions_old;
        -- primary key names must be unique, so free the old ones up for the new tables
        alter table public.challenge_completions_old rename constraint challenge_completions_pkey to challenge_completions_old_pkey;
    end if;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'challenges' and column_name = 'stop_id') then
        alter table public.challenges rename to challenges_old;
        alter table public.challenges_old rename constraint challenges_pkey to challenges_old_pkey;
    end if;
end $$;


-- 2. Now run stop_activities.sql, then (in order) passport.sql, profile.sql, cards.sql, shop.sql
