-- Collectible cards: earned for trips, signposts, challenges and Pioneer photos (some only from the shop)
-- Run this once in the Supabase dashboard AFTER place_photos.sql, stop_activities.sql and passport.sql: SQL Editor -> New query -> paste -> Run
-- Safe to run again: everything below is create-if-missing / replace


-- 1. The card catalogue. Everyone logged in can read it, only admins change it (through SQL, like the seed in section 6)
create table if not exists public.cards (
    id            text primary key,           -- slug, e.g. 'first-ride'
    name          text not null,
    description   text,
    rarity        text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
    art_path      text,                       -- file path inside the card-art bucket, null until the art is uploaded
    unlock_kind   text not null check (unlock_kind in ('trips', 'signposts', 'challenges', 'pioneer', 'shop')),
    unlock_count  int not null default 1,     -- how many of unlock_kind you need (ignored for 'shop' cards)
    sort_order    int
);

alter table public.cards enable row level security;

drop policy if exists "cards: logged in users can view" on public.cards;
create policy "cards: logged in users can view"
on public.cards for select to authenticated using (true);


-- 2. Which cards each user owns. Users can read their own, but only the functions below (and the shop) can add rows
create table if not exists public.user_cards (
    user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    card_id      text not null references public.cards (id) on delete cascade,
    unlocked_at  timestamptz not null default now(),
    primary key (user_id, card_id)
);

alter table public.user_cards enable row level security;

drop policy if exists "user cards: read your own" on public.user_cards;
create policy "user cards: read your own"
on public.user_cards for select to authenticated
using (user_id = auth.uid());


-- 3. Storage bucket for the card art (public read, 2 MB max, images only).
--    No upload policy: art is added by admins in the dashboard, not from the browser
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-art', 'card-art', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;


-- 4. Count what the user has done and hand out every card they've now earned. Returns the newly unlocked card ids.
--    It takes any user id, so the browser must never call it directly (you could unlock cards for someone else).
--    So: the inner function isn't granted to anyone (only the triggers below use it), and the browser calls
--    claim_card_unlocks() instead, which always passes auth.uid()
create or replace function public.check_card_unlocks(uid uuid)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
    trips       int;
    signs       int;
    challenges  int;
    pioneers    int;
begin
    if uid is null then
        return;
    end if;

    select count(*) into trips      from passport_entries      where user_id = uid;
    select count(*) into signs      from signposts             where user_id = uid;
    select count(*) into challenges from challenge_completions where user_id = uid;
    select count(*) into pioneers   from place_photos          where user_id = uid and is_pioneer;

    -- shop cards are left out, those only come from buying them
    return query
    insert into user_cards (user_id, card_id)
    select uid, c.id
    from cards c
    where (c.unlock_kind = 'trips'      and trips      >= c.unlock_count)
       or (c.unlock_kind = 'signposts'  and signs      >= c.unlock_count)
       or (c.unlock_kind = 'challenges' and challenges >= c.unlock_count)
       or (c.unlock_kind = 'pioneer'    and pioneers   >= c.unlock_count)
    on conflict do nothing
    returning user_cards.card_id;
end;
$$;

revoke execute on function public.check_card_unlocks(uuid) from public, anon, authenticated;

-- what the browser calls (rpc 'claim_card_unlocks'), e.g. to catch up on cards earned before this file was run
create or replace function public.claim_card_unlocks()
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
    return query select * from check_card_unlocks(auth.uid());
end;
$$;

revoke execute on function public.claim_card_unlocks() from public, anon;
grant execute on function public.claim_card_unlocks() to authenticated;


-- 5. Check for new cards straight after a trip, signpost, challenge completion or photo is added.
--    If the card check ever fails it only logs a warning, so it can't block the user's actual post
create or replace function public.handle_card_unlock_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    begin
        perform check_card_unlocks(new.user_id);
    exception when others then
        raise warning 'card unlock check failed for %: %', new.user_id, sqlerrm;
    end;
    return new;
end;
$$;

revoke execute on function public.handle_card_unlock_trigger() from public, anon, authenticated;

drop trigger if exists on_passport_entries_check_cards on public.passport_entries;
create trigger on_passport_entries_check_cards
after insert on public.passport_entries
for each row execute function public.handle_card_unlock_trigger();

drop trigger if exists on_place_photos_check_cards on public.place_photos;
create trigger on_place_photos_check_cards
after insert on public.place_photos
for each row execute function public.handle_card_unlock_trigger();

drop trigger if exists on_signposts_check_cards on public.signposts;
create trigger on_signposts_check_cards
after insert on public.signposts
for each row execute function public.handle_card_unlock_trigger();

drop trigger if exists on_challenge_completions_check_cards on public.challenge_completions;
create trigger on_challenge_completions_check_cards
after insert on public.challenge_completions
for each row execute function public.handle_card_unlock_trigger();


-- 6. Starter cards. Running this again won't duplicate or overwrite them
insert into public.cards (id, name, description, rarity, unlock_kind, unlock_count, sort_order) values
    ('first-ride',        'First Ride',         'You tapped in and rode off somewhere new. Every great adventure starts at a bus stop.', 'common',    'trips',       1,  10),
    ('regular-commuter',  'Regular Commuter',   'Five trips logged. The bus captain is starting to recognise you.',                      'rare',      'trips',       5,  20),
    ('island-hopper',     'Island Hopper',      'Fifteen trips across the island. North, south, east or west, you have been there.',     'epic',      'trips',       15, 30),
    ('first-signpost',    'Trail Marker',       'You left your first signpost so the next explorer knows where to go.',                  'common',    'signposts',   1,  40),
    ('local-guide',       'Local Guide',        'Five signposts pinned. Practically a walking kopitiam directory.',                      'rare',      'signposts',   5,  50),
    ('challenge-accepted','Challenge Accepted', 'You took on another explorer''s challenge and brought back the proof.',                 'common',    'challenges',  1,  60),
    ('quest-master',      'Quest Master',       'Five challenges done. No dare is too far from the nearest stop.',                       'epic',      'challenges',  5,  70),
    ('pioneer',           'Pioneer',            'First person ever to photograph a place. You put it on the map.',                       'rare',      'pioneer',     1,  80),
    ('trailblazer',       'Trailblazer',        'Five places pioneered. The map is filling in behind you.',                              'epic',      'pioneer',     5,  90),
    ('golden-double-decker','Golden Double Decker','A legendary gold double decker that only runs for collectors. Shop exclusive.',      'legendary', 'shop',        1,  100)
on conflict (id) do nothing;
