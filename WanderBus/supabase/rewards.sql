-- Rewards v2: equippable perks, brand vouchers, earned badges and a welcome bonus
-- Run this once in the Supabase dashboard AFTER shop.sql and passport_stop_code.sql: SQL Editor -> New query -> paste -> Run
-- (shop.sql needs place_photos.sql, stop_activities.sql and cards.sql before it, and passport.sql + the groups table must exist)
-- Safe to run again: everything is "if not exists" / "or replace" / "on conflict"


-- 1. Shop items get a slot (where a perk goes on you), a stock limit and a brand (for vouchers)
alter table public.shop_items add column if not exists slot text
    check (slot is null or slot in ('ticket_theme', 'stamp_theme', 'mascot_hat', 'pass_skin'));
alter table public.shop_items add column if not exists stock int check (stock is null or stock >= 0);   -- null = unlimited
alter table public.shop_items add column if not exists brand text;                                       -- voucher brand, e.g. 'Ya Kun Kaya Toast'

-- allow 'voucher' as a kind. The old check has an auto-made name, so look it up and drop it first
do $$
declare
    con  record;
begin
    for con in
        select conname from pg_constraint
        where conrelid = 'public.shop_items'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) like '%kind = ANY%'
    loop
        execute format('alter table public.shop_items drop constraint %I', con.conname);
    end loop;
end;
$$;

alter table public.shop_items add constraint shop_items_kind_check
    check (kind in ('card', 'badge', 'perk', 'voucher'));


-- 2. Voucher details on each purchase. Users can already read their own rows (shop.sql)
alter table public.redemptions add column if not exists voucher_code text;
alter table public.redemptions add column if not exists expires_at timestamptz;
alter table public.redemptions add column if not exists used_at timestamptz;

create index if not exists redemptions_item_id_idx on public.redemptions (item_id);
create unique index if not exists redemptions_voucher_code_idx on public.redemptions (voucher_code) where voucher_code is not null;


-- 3. What each user has equipped, one item per slot. Everyone logged in can see it
--    (so others see your look), only equip_item() / unequip_item() / redeem_item() can change it
create table if not exists public.user_equipped (
    user_id      uuid not null references auth.users (id) on delete cascade,
    slot         text not null,
    item_id      bigint not null references public.shop_items (id),
    equipped_at  timestamptz not null default now(),
    primary key (user_id, slot)
);

alter table public.user_equipped enable row level security;

drop policy if exists "user equipped: logged in users can view" on public.user_equipped;
create policy "user equipped: logged in users can view"
on public.user_equipped for select to authenticated using (true);


-- 4. Buy an item. Same as shop.sql, plus: no buying the same thing twice, voucher stock + codes,
--    and a new perk is put on straight away if that slot is empty.
--    Called from the app with rpc('redeem_item', { p_item_id })
create or replace function public.redeem_item(p_item_id bigint)
returns table (credits integer, redemption_id bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    uid        uuid := auth.uid();
    item       shop_items%rowtype;
    balance    integer;
    new_id     bigint;
    sold       integer;
    code       text;
    code_hash  bytea;
    alphabet   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- no I, O, 0 or 1, they're easy to mix up
begin
    if uid is null then
        raise exception 'You need to be logged in to redeem rewards';
    end if;

    select * into item from shop_items where id = p_item_id and active;
    if not found then
        raise exception 'Item not found';
    end if;

    -- make sure the user has a credits row, then lock it so two buys at once can't both spend the same credits
    insert into user_rewards (user_id, credits) values (uid, 0)
    on conflict (user_id) do nothing;

    select r.credits into balance from user_rewards r where r.user_id = uid for update;
    balance := coalesce(balance, 0);

    -- checked after the lock, so double clicking can't buy the same thing twice
    if item.kind = 'card' and exists (select 1 from user_cards uc where uc.user_id = uid and uc.card_id = item.card_id) then
        raise exception 'You already own this card';
    end if;

    if item.kind <> 'voucher' and exists (select 1 from redemptions rd where rd.user_id = uid and rd.item_id = item.id) then
        raise exception 'You already own this';
    end if;

    -- vouchers: lock the item so two people can't both get the last one
    if item.kind = 'voucher' and item.stock is not null then
        perform 1 from shop_items si where si.id = item.id for update;
        select count(*) into sold from redemptions rd where rd.item_id = item.id;
        if sold >= item.stock then
            raise exception 'Sold out';
        end if;
    end if;

    if balance < item.cost then
        raise exception 'Not enough credits (need %, you have %)', item.cost, balance;
    end if;

    -- voucher code: 8 characters from the alphabet above, made from a random uuid.
    -- 256 is a multiple of 32, so every character is equally likely. Tries again on the rare clash
    if item.kind = 'voucher' then
        loop
            code_hash := decode(md5(gen_random_uuid()::text), 'hex');
            code := '';
            for i in 0..7 loop
                code := code || substr(alphabet, (get_byte(code_hash, i) % 32) + 1, 1);
            end loop;
            exit when not exists (select 1 from redemptions rd where rd.voucher_code = code);
        end loop;
    end if;

    update user_rewards r set credits = r.credits - item.cost, updated_at = now()
    where r.user_id = uid
    returning r.credits into balance;

    insert into redemptions (user_id, item_id, cost, voucher_code, expires_at)
    values (uid, item.id, item.cost, code,
            case when item.kind = 'voucher' then now() + interval '30 days' end)
    returning id into new_id;

    if item.kind = 'card' then
        insert into user_cards (user_id, card_id) values (uid, item.card_id)
        on conflict (user_id, card_id) do nothing;
    end if;

    -- put the new perk on if nothing is in that slot yet
    if item.kind = 'perk' and item.slot is not null then
        insert into user_equipped (user_id, slot, item_id) values (uid, item.slot, item.id)
        on conflict on constraint user_equipped_pkey do nothing;
    end if;

    return query select balance, new_id;
end;
$$;

revoke execute on function public.redeem_item(bigint) from public, anon;
grant execute on function public.redeem_item(bigint) to authenticated;


-- 5. Put on / take off a perk. Called with rpc('equip_item', { p_item_id }) and rpc('unequip_item', { p_slot })
create or replace function public.equip_item(p_item_id bigint)
returns table (slot text, item_id bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    uid   uuid := auth.uid();
    item  shop_items%rowtype;
begin
    if uid is null then
        raise exception 'You need to be logged in';
    end if;

    -- not checking active, so you can still wear something that's no longer on sale
    select * into item from shop_items where id = p_item_id;
    if not found then
        raise exception 'Item not found';
    end if;

    if item.slot is null then
        raise exception 'This item can''t be equipped';
    end if;

    if not exists (select 1 from redemptions rd where rd.user_id = uid and rd.item_id = item.id) then
        raise exception 'You don''t own this item';
    end if;

    insert into user_equipped (user_id, slot, item_id, equipped_at) values (uid, item.slot, item.id, now())
    on conflict on constraint user_equipped_pkey
    do update set item_id = excluded.item_id, equipped_at = now();

    return query select item.slot, item.id;
end;
$$;

revoke execute on function public.equip_item(bigint) from public, anon;
grant execute on function public.equip_item(bigint) to authenticated;

create or replace function public.unequip_item(p_slot text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid  uuid := auth.uid();
begin
    if uid is null then
        raise exception 'You need to be logged in';
    end if;

    delete from user_equipped ue where ue.user_id = uid and ue.slot = p_slot;
end;
$$;

revoke execute on function public.unequip_item(text) from public, anon;
grant execute on function public.unequip_item(text) to authenticated;


-- 6. Mark a voucher as used at the counter. Returns when it was used (the first time, if pressed again).
--    Called with rpc('mark_voucher_used', { p_redemption_id })
create or replace function public.mark_voucher_used(p_redemption_id bigint)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    uid        uuid := auth.uid();
    owner_id   uuid;
    item_kind  text;
    used       timestamptz;
    expires    timestamptz;
begin
    if uid is null then
        raise exception 'You need to be logged in';
    end if;

    select rd.user_id, si.kind, rd.used_at, rd.expires_at
    into owner_id, item_kind, used, expires
    from redemptions rd
    join shop_items si on si.id = rd.item_id
    where rd.id = p_redemption_id
    for update of rd;

    if not found or owner_id <> uid then
        raise exception 'Voucher not found';
    end if;

    if item_kind <> 'voucher' then
        raise exception 'This isn''t a voucher';
    end if;

    if used is null then
        if expires is not null and expires < now() then
            raise exception 'This voucher has expired';
        end if;

        update redemptions rd set used_at = now()
        where rd.id = p_redemption_id
        returning rd.used_at into used;
    end if;

    return used;
end;
$$;

revoke execute on function public.mark_voucher_used(bigint) from public, anon;
grant execute on function public.mark_voucher_used(bigint) to authenticated;


-- 7. Badges are now earned, not bought. Everyone logged in can see the list and who has what
create table if not exists public.badges (
    id           text primary key,   -- slug, e.g. 'explorer'
    name         text not null,
    description  text,
    icon         text,               -- Bootstrap Icons name, e.g. 'bi-compass'
    sort_order   int
);

alter table public.badges enable row level security;

drop policy if exists "badges: logged in users can view" on public.badges;
create policy "badges: logged in users can view"
on public.badges for select to authenticated using (true);

-- only check_badges() below can add rows
create table if not exists public.user_badges (
    user_id    uuid not null references auth.users (id) on delete cascade,
    badge_id   text not null references public.badges (id) on delete cascade,
    earned_at  timestamptz not null default now(),
    primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;

drop policy if exists "user badges: logged in users can view" on public.user_badges;
create policy "user badges: logged in users can view"
on public.user_badges for select to authenticated using (true);


-- 8. Count what the user has done and hand out every badge they've now earned. Returns the new badge ids.
--    Same as cards.sql: the inner function takes any user id, so it isn't granted to anyone (only the
--    triggers below use it), and the browser calls claim_badges() instead, which always passes auth.uid()
create or replace function public.check_badges(uid uuid)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
    trips       int;
    end_stops   int;
    pioneers    int;
    signs       int;
    challenges  int;
    night_trip  boolean;
    hosted      int;
begin
    if uid is null then
        return;
    end if;

    select count(*), count(distinct end_stop) into trips, end_stops from passport_entries where user_id = uid;
    select count(*) into pioneers   from place_photos          where user_id = uid and is_pioneer;
    select count(*) into signs      from signposts             where user_id = uid;
    select count(*) into challenges from challenge_completions where user_id = uid;
    select count(*) into hosted     from groups                where host_id = uid;

    -- a trip at 9pm or later, or before 4am, Singapore time
    select exists (
        select 1 from passport_entries
        where user_id = uid
          and (extract(hour from entry_time at time zone 'Asia/Singapore') >= 21
               or extract(hour from entry_time at time zone 'Asia/Singapore') < 4)
    ) into night_trip;

    return query
    insert into user_badges (user_id, badge_id)
    select uid, b.id
    from badges b
    where (b.id = 'explorer'     and trips      >= 10)
       or (b.id = 'stop-hopper'  and end_stops  >= 10)
       or (b.id = 'pioneer'      and pioneers   >= 5)
       or (b.id = 'local-guide'  and signs      >= 10)
       or (b.id = 'challenger'   and challenges >= 10)
       or (b.id = 'night-owl'    and night_trip)
       or (b.id = 'crew-captain' and hosted     >= 3)
    on conflict do nothing
    returning user_badges.badge_id;
end;
$$;

revoke execute on function public.check_badges(uuid) from public, anon, authenticated;

-- what the browser calls (rpc 'claim_badges'), e.g. to catch up on badges earned before this file was run
create or replace function public.claim_badges()
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
    return query select * from check_badges(auth.uid());
end;
$$;

revoke execute on function public.claim_badges() from public, anon;
grant execute on function public.claim_badges() to authenticated;


-- 9. Check for new badges straight after a trip, photo, signpost, challenge completion or new group.
--    groups has host_id instead of user_id. If the check ever fails it only logs a warning,
--    so it can't block the user's actual post (same as cards.sql)
create or replace function public.handle_badge_check_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    uid  uuid;
begin
    begin
        if tg_table_name = 'groups' then
            uid := new.host_id;
        else
            uid := new.user_id;
        end if;

        perform check_badges(uid);
    exception when others then
        raise warning 'badge check failed for %: %', uid, sqlerrm;
    end;
    return new;
end;
$$;

revoke execute on function public.handle_badge_check_trigger() from public, anon, authenticated;

drop trigger if exists on_passport_entries_check_badges on public.passport_entries;
create trigger on_passport_entries_check_badges
after insert on public.passport_entries
for each row execute function public.handle_badge_check_trigger();

drop trigger if exists on_place_photos_check_badges on public.place_photos;
create trigger on_place_photos_check_badges
after insert on public.place_photos
for each row execute function public.handle_badge_check_trigger();

drop trigger if exists on_signposts_check_badges on public.signposts;
create trigger on_signposts_check_badges
after insert on public.signposts
for each row execute function public.handle_badge_check_trigger();

drop trigger if exists on_challenge_completions_check_badges on public.challenge_completions;
create trigger on_challenge_completions_check_badges
after insert on public.challenge_completions
for each row execute function public.handle_badge_check_trigger();

drop trigger if exists on_groups_check_badges on public.groups;
create trigger on_groups_check_badges
after insert on public.groups
for each row execute function public.handle_badge_check_trigger();


-- 10. Welcome bonus: 200 credits once per account, on signup. The unique index means it can only pay once,
--     even if the function runs again (e.g. the backfill at the bottom)
insert into public.credit_rules (source, amount, daily_limit) values
    ('welcome', 200, null)   -- once per account, on signup
on conflict (source) do update set amount = excluded.amount, daily_limit = excluded.daily_limit;

create unique index if not exists credit_awards_welcome_once_idx on public.credit_awards (user_id) where source = 'welcome';

-- returns true if the bonus was paid now, false if they already had it.
-- Takes any user id, so it isn't granted to anyone
create or replace function public.grant_welcome_bonus(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    bonus     integer;
    inserted  integer;
begin
    if uid is null then
        return false;
    end if;

    select amount into bonus from credit_rules where source = 'welcome';
    bonus := coalesce(bonus, 200);

    insert into credit_awards (user_id, source, amount) values (uid, 'welcome', bonus)
    on conflict (user_id) where source = 'welcome' do nothing;

    get diagnostics inserted = row_count;
    if inserted = 0 then
        return false;
    end if;

    insert into user_rewards (user_id, credits) values (uid, bonus)
    on conflict (user_id) do update set credits = user_rewards.credits + bonus, updated_at = now();

    return true;
end;
$$;

revoke execute on function public.grant_welcome_bonus(uuid) from public, anon, authenticated;

-- runs when someone signs up. If the bonus ever fails it only logs a warning, so signup never fails
create or replace function public.handle_new_user_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    begin
        perform grant_welcome_bonus(new.id);
    exception when others then
        raise warning 'welcome bonus failed for %: %', new.id, sqlerrm;
    end;
    return new;
end;
$$;

revoke execute on function public.handle_new_user_welcome() from public, anon, authenticated;

drop trigger if exists on_auth_user_welcome on auth.users;
create trigger on_auth_user_welcome
after insert on auth.users
for each row execute function public.handle_new_user_welcome();


-- 11. Shop items. Existing rows only get their description updated, new ones are added
insert into public.shop_items (slug, name, description, cost, kind, card_id, sort_order) values
    ('card-golden-double-decker', 'Golden Double Decker card', 'Legendary card. It joins your card collection.', 500, 'card', 'golden-double-decker', 1),
    ('card-night-owl-bus',        'Night Owl Bus card',        'Epic card. It joins your card collection.',      250, 'card', 'night-owl-bus',        2)
on conflict (slug) do update set description = excluded.description;

insert into public.shop_items (slug, name, description, cost, kind, slot, sort_order) values
    ('perk-mascot-captain', 'Mascot hat: captain',      'Your mascot wears a captain''s cap on your bus pass and in the header.', 120, 'perk', 'mascot_hat',   5),
    ('perk-ticket-sunset',  'Ticket theme: sunset',     'Changes your spin tickets to sunset colours.',                           100, 'perk', 'ticket_theme', 6),
    ('perk-stamp-gold',     'Stamp theme: gold foil',   'Your passport stamps get a gold foil finish.',                           150, 'perk', 'stamp_theme',  7),
    ('perk-pass-night',     'Bus pass skin: night bus', 'Your bus pass turns night-bus dark.',                                    130, 'perk', 'pass_skin',    8)
on conflict (slug) do update set description = excluded.description;

-- the two older perks were made before slots existed
update public.shop_items set slot = 'mascot_hat'   where slug = 'perk-mascot-captain';
update public.shop_items set slot = 'ticket_theme' where slug = 'perk-ticket-sunset';

-- badges are earned now (section 7), so take them off sale. Old purchases stay in redemptions
update public.shop_items set active = false where slug in ('badge-explorer', 'badge-supporter');

-- partner vouchers, 25 of each
insert into public.shop_items (slug, name, description, cost, kind, brand, stock, sort_order) values
    ('voucher-hardrock',    'Hard Rock Cafe: $10 off your bill',     'Show the code at the counter. Valid for 30 days.', 600, 'voucher', 'Hard Rock Cafe',    25, 20),
    ('voucher-yakun',       'Ya Kun Kaya Toast: free kaya toast set', 'Show the code at the counter. Valid for 30 days.', 300, 'voucher', 'Ya Kun Kaya Toast', 25, 21),
    ('voucher-oldchangkee', 'Old Chang Kee: free curry puff',        'Show the code at the counter. Valid for 30 days.', 200, 'voucher', 'Old Chang Kee',     25, 22),
    ('voucher-gv',          'Golden Village: $5 off a movie ticket', 'Show the code at the counter. Valid for 30 days.', 450, 'voucher', 'Golden Village',    25, 23)
on conflict (slug) do nothing;


-- 12. Badge list. Running this again updates the names and icons
insert into public.badges (id, name, description, icon, sort_order) values
    ('explorer',     'Explorer',     'Logged 10 trips in your passport.',                 'bi-compass',        10),
    ('stop-hopper',  'Stop hopper',  'Ended trips at 10 different bus stops.',            'bi-signpost-split', 20),
    ('pioneer',      'Pioneer',      'First to photograph 5 places.',                     'bi-camera',         30),
    ('local-guide',  'Local guide',  'Left 10 signposts for other explorers.',            'bi-geo-alt',        40),
    ('challenger',   'Challenger',   'Completed 10 challenges.',                          'bi-trophy',         50),
    ('night-owl',    'Night owl',    'Took a trip after 9pm or before 4am.',              'bi-moon-stars',     60),
    ('crew-captain', 'Crew captain', 'Hosted 3 group trips.',                             'bi-people',         70)
on conflict (id) do update set name = excluded.name, description = excluded.description,
    icon = excluded.icon, sort_order = excluded.sort_order;


-- 13. Backfill: give the welcome bonus to everyone who signed up before this file. Safe to run again,
--     the unique index in section 10 stops anyone getting it twice
select public.grant_welcome_bonus(id) from auth.users;


-- 14. Backfill: put on the looks people bought before equipping existed (oldest purchase per slot).
--     Safe to run again: a slot that's already filled is left alone
insert into public.user_equipped (user_id, slot, item_id)
select distinct on (r.user_id, i.slot) r.user_id, i.slot, i.id
from public.redemptions r
join public.shop_items i on i.id = r.item_id
where i.slot is not null
order by r.user_id, i.slot, r.created_at
on conflict (user_id, slot) do nothing;
