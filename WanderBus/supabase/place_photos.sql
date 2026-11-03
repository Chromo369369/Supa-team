-- Part 6: community photos for places around a stop + Pioneer credits
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run

-- 1. Storage bucket for the photos (public read, 5 MB max, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- logged in users can only upload into their own folder: <user id>/...
create policy "place photos: upload into own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "place photos: delete own files"
on storage.objects for delete to authenticated
using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- 2. One row per uploaded photo
create table if not exists public.place_photos (
    id          bigint generated always as identity primary key,
    place_id    text not null,              -- e.g. 'osm:node/8941731747' from /api/stops/[code]/places
    place_name  text,
    stop_code   text,
    lat         double precision not null,  -- lets the page fetch every photo inside the walking circle in one query
    lon         double precision not null,
    path        text not null,              -- file path inside the place-photos bucket
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    is_pioneer  boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists place_photos_place_id_idx on public.place_photos (place_id);
create index if not exists place_photos_lat_lon_idx on public.place_photos (lat, lon);

alter table public.place_photos enable row level security;

create policy "place photos: anyone can view"
on public.place_photos for select using (true);

create policy "place photos: add your own"
on public.place_photos for insert to authenticated
with check (user_id = auth.uid());

create policy "place photos: delete your own"
on public.place_photos for delete to authenticated
using (user_id = auth.uid());


-- 3. Credits per user. Users can read their own, but only the trigger below can change them
create table if not exists public.user_rewards (
    user_id     uuid primary key references auth.users (id) on delete cascade,
    credits     integer not null default 0,
    updated_at  timestamptz not null default now()
);

alter table public.user_rewards enable row level security;

create policy "user rewards: read your own"
on public.user_rewards for select to authenticated
using (user_id = auth.uid());


-- 4. Who pioneered each place. Kept separate from place_photos so deleting a photo
--    and re-uploading can't earn the +100 twice. No policies = the browser can't touch it
create table if not exists public.pioneered_places (
    place_id    text primary key,
    user_id     uuid not null references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now()
);

alter table public.pioneered_places enable row level security;


-- 5. Decide Pioneer + award credits inside the database, so the browser can't fake it
create or replace function public.handle_new_place_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.user_id := auth.uid();
    if new.user_id is null then
        raise exception 'You need to be logged in to upload photos';
    end if;

    -- the file must be in the uploader's own folder
    if split_part(new.path, '/', 1) <> new.user_id::text then
        raise exception 'Invalid photo path';
    end if;

    -- basic spam limit
    if (select count(*) from place_photos where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
        raise exception 'Daily upload limit reached (20 photos), try again tomorrow';
    end if;

    -- first ever photo of this place? place_id is the primary key, so if two people
    -- upload at the same moment only one insert succeeds
    insert into pioneered_places (place_id, user_id) values (new.place_id, new.user_id)
    on conflict (place_id) do nothing;
    new.is_pioneer := found;
    new.created_at := now();

    if new.is_pioneer then
        insert into user_rewards (user_id, credits) values (new.user_id, 100)
        on conflict (user_id) do update set credits = user_rewards.credits + 100, updated_at = now();
    end if;

    return new;
end;
$$;

drop trigger if exists on_new_place_photo on public.place_photos;
create trigger on_new_place_photo
before insert on public.place_photos
for each row execute function public.handle_new_place_photo();
