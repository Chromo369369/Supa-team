-- Passport: one row per trip a user saves from the spin page (solo or group)
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run
-- This table was first made by hand in the dashboard. Step 1 matches the live table, so if it
-- already exists step 1 does nothing and only the policies in step 2 are applied.
-- BEFORE RUNNING: check Authentication -> Policies -> passport_entries in the dashboard. Policies
-- under other names stay in place and are OR'd with these, so an old open one would still let rows through.


-- 1. Saved trips (there is no created_at column, entry_time is the trip's time)
create table if not exists public.passport_entries (
    id                 bigint generated always as identity primary key,
    user_id            uuid default auth.uid(),  -- nullable in the live table
    entry_time         timestamptz default now(),
    starting_stop      varchar not null,         -- bus stop name the trip started from
    bus_taken          text,                     -- bus service number, e.g. '12'. Empty / 'Walk' = walked
    end_stop           varchar not null,         -- bus stop name the spin landed on
    time_taken         integer not null,         -- minutes, rounded up
    entry_notes        text,                     -- added later from the passport page
    starting_location  text not null,            -- the address the user searched from
    photo_url          text,                     -- a compressed jpeg data url, added later from the passport page
    constraint fk_uid foreign key (user_id) references auth.users (id)
);


-- 2. Row level security: "Your trips and passport stay private to you" (register page),
--    so every action is limited to your own rows
alter table public.passport_entries enable row level security;

drop policy if exists "passport entries: view your own" on public.passport_entries;
create policy "passport entries: view your own" on public.passport_entries for select to authenticated using (user_id = auth.uid());

drop policy if exists "passport entries: add your own" on public.passport_entries;
create policy "passport entries: add your own" on public.passport_entries for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "passport entries: edit your own" on public.passport_entries;
create policy "passport entries: edit your own" on public.passport_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "passport entries: delete your own" on public.passport_entries;
create policy "passport entries: delete your own" on public.passport_entries for delete to authenticated using (user_id = auth.uid());
