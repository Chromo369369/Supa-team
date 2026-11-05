-- Reward shop: spend credits on cards, badges and perks + more ways to earn credits
-- Run this once in the Supabase dashboard AFTER place_photos.sql, stop_activities.sql and cards.sql
-- (the shop's card items point at public.cards): SQL Editor -> New query -> paste -> Run
-- Needs stop_activities.sql's signposts + challenge_completions tables (bigint ids, created_at) in place first.
-- The old live challenges/challenge_completions shape (uuid ids, completed_at) must be replaced before running this
-- Safe to run again: everything is "if not exists" / "or replace" / "on conflict"


-- 1. HOW MANY CREDITS EACH ACTION GIVES  <-- change the numbers here, then run the file again
--    PLACEHOLDER AMOUNTS, the team still needs to decide these.
--    daily_limit = max times per user per day that action pays out (null = no limit).
--    Pioneer photos (+100) are still handled in place_photos.sql, not here.
--    No policies = the browser can't read or change these
create table if not exists public.credit_rules (
    source       text primary key,   -- 'signpost' | 'challenge' | 'trip'
    amount       integer not null check (amount >= 0),
    daily_limit  integer check (daily_limit is null or daily_limit > 0)
);

alter table public.credit_rules enable row level security;

insert into public.credit_rules (source, amount, daily_limit) values
    ('signpost',  10, 5),    -- leaving a signpost near a stop
    ('challenge', 30, 10),   -- completing someone else's challenge
    ('trip',      20, 5)     -- saving a trip to the passport
on conflict (source) do update set amount = excluded.amount, daily_limit = excluded.daily_limit;


-- 2. Log of every credit payout from section 6. Used for the daily limits instead of counting
--    signposts/passport_entries rows (passport_entries has entry_time, not created_at), and kept even
--    if the signpost/trip is deleted, so deleting and re-adding can't get past the limit.
--    Trade-off: inside the limit, deleting and re-adding a signpost or trip still pays again
--    (up to 5 x 10 = 50 a day for signposts). Good enough for now.
--    No policies = the browser can't touch it
create table if not exists public.credit_awards (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references auth.users (id) on delete cascade,
    source      text not null,
    amount      integer not null,
    created_at  timestamptz not null default now()
);

create index if not exists credit_awards_user_source_idx on public.credit_awards (user_id, source, created_at);

alter table public.credit_awards enable row level security;


-- 3. Things you can buy. Logged in users can see the items on sale, only the dashboard can add/change them
create table if not exists public.shop_items (
    id           bigint generated always as identity primary key,
    slug         text unique not null,
    name         text not null,
    description  text,
    cost         integer not null check (cost > 0),
    kind         text not null check (kind in ('card', 'badge', 'perk')),
    card_id      text references public.cards (id),   -- which card you get, only for kind = 'card'
    active       boolean not null default true,
    sort_order   integer,
    constraint shop_items_card_needs_card_id check (kind <> 'card' or card_id is not null)
);

alter table public.shop_items enable row level security;

drop policy if exists "shop items: logged in users can view active" on public.shop_items;
create policy "shop items: logged in users can view active"
on public.shop_items for select to authenticated
using (active);


-- 4. One row per purchase. Users can read their own, only redeem_item() below can add them
create table if not exists public.redemptions (
    id          bigint generated always as identity primary key,
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    item_id     bigint not null references public.shop_items (id),
    cost        integer not null,   -- price paid, in case the item's price changes later
    created_at  timestamptz not null default now()
);

create index if not exists redemptions_user_id_idx on public.redemptions (user_id, created_at);

alter table public.redemptions enable row level security;

drop policy if exists "redemptions: read your own" on public.redemptions;
create policy "redemptions: read your own"
on public.redemptions for select to authenticated
using (user_id = auth.uid());


-- 5. Buy an item: check the price, take the credits, record it, hand out the card. All inside the
--    database so the browser can't fake it. Called from the app with rpc('redeem_item', { p_item_id })
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

    -- checked after the lock, so double clicking can't buy the same card twice
    if item.kind = 'card' and exists (select 1 from user_cards uc where uc.user_id = uid and uc.card_id = item.card_id) then
        raise exception 'You already own this card';
    end if;

    if balance < item.cost then
        raise exception 'Not enough credits (need %, you have %)', item.cost, balance;
    end if;

    update user_rewards r set credits = r.credits - item.cost, updated_at = now()
    where r.user_id = uid
    returning r.credits into balance;

    insert into redemptions (user_id, item_id, cost) values (uid, item.id, item.cost)
    returning id into new_id;

    if item.kind = 'card' then
        insert into user_cards (user_id, card_id) values (uid, item.card_id)
        on conflict (user_id, card_id) do nothing;
    end if;

    return query select balance, new_id;
end;
$$;

revoke execute on function public.redeem_item(bigint) from public, anon;
grant execute on function public.redeem_item(bigint) to authenticated;


-- 6. Extra ways to earn credits: leaving a signpost, completing a challenge, saving a trip.
--    One shared function, the amount comes from credit_rules (section 1) by table name.
--    It never blocks the insert, it just skips the payout when the daily limit is reached
create or replace function public.award_credits_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    uid          uuid := auth.uid();
    rule_source  text;
    rule         credit_rules%rowtype;
begin
    if uid is null then
        return new;
    end if;

    -- if the payout ever fails it only logs a warning, so it can't block the user's actual post (same as cards.sql)
    begin
    rule_source := case tg_table_name
        when 'signposts' then 'signpost'
        when 'challenge_completions' then 'challenge'
        when 'passport_entries' then 'trip'
    end;

    select * into rule from credit_rules where source = rule_source;
    if not found or rule.amount = 0 then
        return new;
    end if;

    -- no credits for completing your own challenge
    if tg_table_name = 'challenge_completions'
       and exists (select 1 from challenges where id = new.challenge_id and user_id = uid) then
        return new;
    end if;

    -- daily limit, counted from the payout log so deleted rows still count
    if rule.daily_limit is not null
       and (select count(*) from credit_awards
            where user_id = uid and source = rule_source and created_at > now() - interval '1 day') >= rule.daily_limit then
        return new;
    end if;

    insert into credit_awards (user_id, source, amount) values (uid, rule_source, rule.amount);

    insert into user_rewards (user_id, credits) values (uid, rule.amount)
    on conflict (user_id) do update set credits = user_rewards.credits + rule.amount, updated_at = now();
    exception when others then
        raise warning 'credit award failed for %: %', uid, sqlerrm;
    end;

    return new;
end;
$$;

drop trigger if exists on_signposts_award_credits on public.signposts;
create trigger on_signposts_award_credits
after insert on public.signposts
for each row execute function public.award_credits_trigger();

drop trigger if exists on_challenge_completions_award_credits on public.challenge_completions;
create trigger on_challenge_completions_award_credits
after insert on public.challenge_completions
for each row execute function public.award_credits_trigger();

drop trigger if exists on_passport_entries_award_credits on public.passport_entries;
create trigger on_passport_entries_award_credits
after insert on public.passport_entries
for each row execute function public.award_credits_trigger();


-- 7. Starter items. 'golden-double-decker' comes from cards.sql, 'night-owl-bus' is a second
--    shop-only card added here (does nothing if it's already there)
insert into public.cards (id, name, description, rarity, unlock_kind, unlock_count, sort_order) values
    ('night-owl-bus', 'Night Owl Bus', 'For explorers who ride after dark. Shop exclusive.', 'epic', 'shop', 1, 110)
on conflict (id) do nothing;

insert into public.shop_items (slug, name, description, cost, kind, card_id, sort_order) values
    ('card-golden-double-decker', 'Golden Double Decker card', 'Legendary card for your collection',        500, 'card',  'golden-double-decker', 1),
    ('card-night-owl-bus',        'Night Owl Bus card',        'Epic card for your collection',             250, 'card',  'night-owl-bus',        2),
    ('badge-explorer',            'Explorer badge',            'Show off on your profile that you explore', 150, 'badge', null,                   3),
    ('badge-supporter',           'Supporter badge',           'A thank you badge for spending credits',     80, 'badge', null,                   4),
    ('perk-mascot-captain',       'Mascot hat: captain',       'Give the mascot a captain''s hat',          120, 'perk',  null,                   5),
    ('perk-ticket-sunset',        'Ticket theme: sunset',      'Warm sunset colours for your trip tickets', 100, 'perk',  null,                   6)
on conflict (slug) do nothing;
