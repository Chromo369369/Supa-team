-- Feature 3: signposts (tips) and challenges that explorers pin on the map around a stop
-- Run this once in the Supabase dashboard AFTER place_photos.sql: SQL Editor -> New query -> paste -> Run
-- Photos go in the place-photos bucket from place_photos.sql (<user id>/signposts/... and <user id>/challenges/...)


-- 1. Signposts: a note + rating left at a spot near the stop
create table if not exists public.signposts (
    id           bigint generated always as identity primary key,
    stop_code    text not null,
    lat          double precision not null,
    lon          double precision not null,
    note         text not null check (char_length(note) between 3 and 280),
    rating       smallint not null check (rating between 1 and 5),
    spent        numeric(6, 2) check (spent is null or spent between 0 and 500),
    photo_path   text,                       -- file path inside the place-photos bucket
    user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    author_name  text,
    created_at   timestamptz not null default now()
);

create index if not exists signposts_stop_code_idx on public.signposts (stop_code);


-- 2. One "helpful" vote per person per signpost
create table if not exists public.signpost_votes (
    signpost_id  bigint not null references public.signposts (id) on delete cascade,
    user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    created_at   timestamptz not null default now(),
    primary key (signpost_id, user_id)
);


-- 3. Challenges: a task for the next explorer, pinned to a spot near the stop
create table if not exists public.challenges (
    id           bigint generated always as identity primary key,
    stop_code    text not null,
    lat          double precision not null,
    lon          double precision not null,
    title        text not null check (char_length(title) between 3 and 80),
    description  text not null check (char_length(description) between 3 and 280),
    hint         text check (hint is null or char_length(hint) <= 120),
    user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    author_name  text,
    created_at   timestamptz not null default now()
);

create index if not exists challenges_stop_code_idx on public.challenges (stop_code);


-- 4. Completing a challenge needs a proof photo, once per person
create table if not exists public.challenge_completions (
    challenge_id  bigint not null references public.challenges (id) on delete cascade,
    user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
    photo_path    text not null,
    created_at    timestamptz not null default now(),
    primary key (challenge_id, user_id)
);


-- 5. Row level security: logged in users can read everything, but only add/change/delete their own rows
alter table public.signposts enable row level security;
alter table public.signpost_votes enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_completions enable row level security;

create policy "signposts: logged in users can view" on public.signposts for select to authenticated using (true);
create policy "signposts: add your own" on public.signposts for insert to authenticated with check (user_id = auth.uid());
create policy "signposts: edit your own" on public.signposts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "signposts: delete your own" on public.signposts for delete to authenticated using (user_id = auth.uid());

create policy "signpost votes: logged in users can view" on public.signpost_votes for select to authenticated using (true);
create policy "signpost votes: add your own" on public.signpost_votes for insert to authenticated with check (user_id = auth.uid());
create policy "signpost votes: remove your own" on public.signpost_votes for delete to authenticated using (user_id = auth.uid());

create policy "challenges: logged in users can view" on public.challenges for select to authenticated using (true);
create policy "challenges: add your own" on public.challenges for insert to authenticated with check (user_id = auth.uid());
create policy "challenges: edit your own" on public.challenges for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "challenges: delete your own" on public.challenges for delete to authenticated using (user_id = auth.uid());

create policy "challenge completions: logged in users can view" on public.challenge_completions for select to authenticated using (true);
create policy "challenge completions: add your own" on public.challenge_completions for insert to authenticated with check (user_id = auth.uid());


-- 6. Fill in who posted it inside the database. The browser can't read other users' names,
--    so the display name from register (raw_user_meta_data.display_name) is copied onto the row
create or replace function public.handle_new_stop_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.user_id := auth.uid();
    if new.user_id is null then
        raise exception 'You need to be logged in to post';
    end if;

    select coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
    into new.author_name
    from auth.users where id = new.user_id;

    new.created_at := now();
    return new;
end;
$$;

drop trigger if exists on_new_signpost on public.signposts;
create trigger on_new_signpost
before insert on public.signposts
for each row execute function public.handle_new_stop_activity();

drop trigger if exists on_new_challenge on public.challenges;
create trigger on_new_challenge
before insert on public.challenges
for each row execute function public.handle_new_stop_activity();
