-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_date     date not null default current_date,
  bus_service   text not null default '',
  bus_stop_code text not null default '',
  bus_stop_name text not null default '',
  memories      text not null default '',
  photo_link    text not null default '',
  is_public     boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.trips enable row level security;

create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);

create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);

create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);
