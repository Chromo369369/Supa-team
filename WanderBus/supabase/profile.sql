-- Profile page: the logged in user's totals in one call
-- Run this once in the Supabase dashboard AFTER place_photos.sql, stop_activities.sql and passport.sql:
-- SQL Editor -> New query -> paste -> Run
-- Depends on the tables from stop_activities.sql (signposts, challenge_completions with that file's shape).
-- The live database has no signposts table yet, and its challenges / challenge_completions are an older
-- shape, so this function will fail to create until stop_activities.sql's tables are in place.


-- 1. One row of counts for whoever is logged in. Runs as the caller (security invoker),
--    so the normal row level security on each table still applies
--    (dropped first because create or replace can't change the columns it returns)
drop function if exists public.profile_stats();

create or replace function public.profile_stats()
returns table (trips int, signposts int, challenges_done int, pioneer_photos int, credits int)
language sql
stable
security invoker
set search_path = public
as $$
    select
        (select count(*) from passport_entries where user_id = auth.uid())::int,
        (select count(*) from signposts where user_id = auth.uid())::int,
        (select count(*) from challenge_completions where user_id = auth.uid())::int,
        (select count(*) from place_photos where user_id = auth.uid() and is_pioneer = true)::int,
        -- user_rewards only has a row once you've earned some credits
        coalesce((select user_rewards.credits from user_rewards where user_id = auth.uid()), 0)::int;
$$;


-- 2. Logged in users can call it from the browser: $supabase.rpc('profile_stats')
grant execute on function public.profile_stats() to authenticated;
