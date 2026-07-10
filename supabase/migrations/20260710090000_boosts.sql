-- Boost / Promotion — pay with G-Pay to promote a post, a shop product or a
-- POS product across the app's feeds.
--
-- Money model (play-money MMK, same wallet as G-Pay):
--   * The whole campaign budget is *escrowed* out of the owner's G-Pay wallet
--     the moment the boost is created (create_boost). Nothing more is ever
--     debited afterwards.
--   * As the ad is served, spent_mmk accrues (record_boost_impression) but no
--     wallet movement happens — the money is already held. When spent reaches
--     the budget the campaign auto-completes.
--   * Cancelling a running campaign refunds the *unspent* remainder
--     (budget - spent) back to the wallet.
--   So the owner's real cost is always exactly `spent_mmk`, and the escrow
--   guarantees the funds to pay for every served impression exist up front.
--
-- Balances/ledger change only inside SECURITY DEFINER functions that flip the
-- gpay.allow_ledger flag, exactly like the reels payout path — clients can
-- neither charge others nor refund themselves.

create type public.boost_target as enum ('post', 'shop_product', 'pos_product');
create type public.boost_status as enum
  ('active', 'paused', 'completed', 'cancelled', 'rejected');

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create table public.boosts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.boost_target not null,
  target_id uuid not null,
  -- A short promotional headline shown on the sponsored card (denormalised so
  -- the ad renders without joining the target table just for a title).
  headline text check (headline is null or char_length(headline) <= 160),

  -- Money (play MMK). budget is escrowed on create; spent accrues on serving.
  budget_mmk numeric(12, 2) not null check (budget_mmk >= 100),
  spent_mmk numeric(12, 2) not null default 0 check (spent_mmk >= 0),
  -- Most that may be spent in a single Yangon-day (paces delivery).
  daily_cap_mmk numeric(12, 2) not null check (daily_cap_mmk >= 50),
  -- Cost per unique daily viewer (CPV bid) — the auction "price".
  bid_mmk numeric(12, 2) not null check (bid_mmk >= 1),

  -- Audience targeting: { "adult": bool, "region": text, "tags": [text] }.
  audience jsonb not null default '{}'::jsonb,

  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  status public.boost_status not null default 'active',

  -- Counters used by both the serving auction and the owner's analytics.
  impressions integer not null default 0, -- billed unique-per-day impressions
  reach integer not null default 0,       -- distinct viewers reached (lifetime)
  clicks integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint boost_window check (end_at > start_at),
  constraint boost_spent_le_budget check (spent_mmk <= budget_mmk),
  constraint boost_cap_le_budget check (daily_cap_mmk <= budget_mmk)
);

create index boosts_owner_idx on public.boosts (owner_id, created_at desc);
-- Serving lookup: active, in-window campaigns by type.
create index boosts_serving_idx
  on public.boosts (target_type, status, end_at)
  where status = 'active';

create trigger boosts_set_updated_at
  before update on public.boosts
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Per-viewer / per-day impression ledger (dedup billing + frequency cap)
-- ---------------------------------------------------------------------------
-- One row per (campaign, viewer, Yangon-day). The first serve that day bills
-- the viewer's owner once (charge_mmk); extra serves the same day only bump
-- `shows` for the frequency cap and are free.
create table public.boost_impressions (
  boost_id uuid not null references public.boosts (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Yangon')::date,
  shows integer not null default 0,
  clicked boolean not null default false,
  charge_mmk numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (boost_id, viewer_id, day)
);

create index boost_impressions_boost_day_idx
  on public.boost_impressions (boost_id, day);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.boosts enable row level security;
alter table public.boost_impressions enable row level security;

-- Owners (and admins) read their own campaigns for the manager/analytics. The
-- serving path reads active campaigns through get_feed_boosts (SECURITY
-- DEFINER), so other users never see a competitor's budget/spend.
create policy "boosts owner read" on public.boosts
  for select using (owner_id = auth.uid() or public.is_admin());

-- All writes go through the SECURITY DEFINER RPCs; no direct insert/update.

-- Impression rows are private plumbing — expose only to admins for auditing.
create policy "boost_impressions admin read" on public.boost_impressions
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Helper: does the caller own the thing they're trying to promote?
-- ---------------------------------------------------------------------------
create or replace function public.owns_boost_target(
  p_type public.boost_target,
  p_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'post' then exists (
      select 1 from public.posts where id = p_id and author_id = auth.uid()
    )
    when 'shop_product' then exists (
      select 1 from public.shop_products where id = p_id and seller_id = auth.uid()
    )
    when 'pos_product' then exists (
      select 1
      from public.pos_products pp
      join public.stores s on s.id = pp.store_id
      where pp.id = p_id and s.owner_id = auth.uid()
    )
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- create_boost — escrow the budget from G-Pay and open the campaign
-- ---------------------------------------------------------------------------
create or replace function public.create_boost(
  p_target_type public.boost_target,
  p_target_id uuid,
  p_headline text,
  p_budget_mmk numeric,
  p_daily_cap_mmk numeric,
  p_bid_mmk numeric,
  p_days integer,
  p_audience jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct public.gpay_accounts;
  v_boost uuid;
  v_days integer := greatest(1, least(coalesce(p_days, 7), 90));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- Amounts must be sane, whole-cent numbers.
  if p_budget_mmk is null or p_budget_mmk < 100
     or p_budget_mmk <> round(p_budget_mmk, 2) then
    raise exception 'Minimum boost budget is 100 MMK';
  end if;
  if p_daily_cap_mmk is null or p_daily_cap_mmk < 50
     or p_daily_cap_mmk > p_budget_mmk then
    raise exception 'Daily cap must be between 50 MMK and the total budget';
  end if;
  if p_bid_mmk is null or p_bid_mmk < 1 or p_bid_mmk <> round(p_bid_mmk, 2) then
    raise exception 'Bid must be at least 1 MMK per view';
  end if;

  if not public.owns_boost_target(p_target_type, p_target_id) then
    raise exception 'You can only boost your own content';
  end if;

  -- Must have an active G-Pay wallet with enough balance to escrow.
  select * into v_acct
    from public.gpay_accounts
    where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'An active G-Pay account is required to boost';
  end if;
  if v_acct.balance < p_budget_mmk then
    raise exception 'Insufficient G-Pay balance for this budget';
  end if;

  -- Escrow: debit the wallet now and log a fee. The money is held against the
  -- campaign; cancel_boost refunds whatever is left unspent.
  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts
    set balance = balance - p_budget_mmk where id = v_acct.id;
  insert into public.gpay_transactions (kind, from_account, amount, note)
    values ('fee', v_acct.id, p_budget_mmk, 'Boost budget');
  perform set_config('gpay.allow_ledger', 'off', true);

  insert into public.boosts (
    owner_id, target_type, target_id, headline,
    budget_mmk, daily_cap_mmk, bid_mmk, audience,
    end_at
  ) values (
    auth.uid(), p_target_type, p_target_id, nullif(btrim(p_headline), ''),
    p_budget_mmk, p_daily_cap_mmk, p_bid_mmk, coalesce(p_audience, '{}'::jsonb),
    now() + make_interval(days => v_days)
  )
  returning id into v_boost;

  return v_boost;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_boost_impression — count a serve and bill it (once per viewer/day)
-- ---------------------------------------------------------------------------
-- Called when a sponsored card actually reaches the viewer's screen. Billing
-- rules:
--   * Never bill the owner for seeing their own ad.
--   * Only the first serve to a given viewer on a given day is billed; repeats
--     that day just bump `shows` (for the frequency cap) at no cost.
--   * The charge is clamped so the campaign never exceeds its budget nor its
--     daily cap; if there's no room, the serve is still shown but free, and the
--     campaign completes once the budget is exhausted.
create or replace function public.record_boost_impression(p_boost uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.boosts;
  v_today date := (now() at time zone 'Asia/Yangon')::date;
  v_spent_today numeric(12, 2);
  v_room_budget numeric(12, 2);
  v_room_daily numeric(12, 2);
  v_charge numeric(12, 2) := 0;
  v_existing public.boost_impressions;
begin
  if auth.uid() is null then
    return;
  end if;

  select * into b from public.boosts where id = p_boost;
  if not found or b.status <> 'active'
     or now() < b.start_at or now() >= b.end_at
     or b.owner_id = auth.uid() then
    return;
  end if;

  select * into v_existing
    from public.boost_impressions
    where boost_id = p_boost and viewer_id = auth.uid() and day = v_today;

  if found then
    -- Already served (and possibly billed) today: just record another show.
    update public.boost_impressions
      set shows = shows + 1
      where boost_id = p_boost and viewer_id = auth.uid() and day = v_today;
    return;
  end if;

  -- First serve to this viewer today → decide the charge.
  select coalesce(sum(charge_mmk), 0) into v_spent_today
    from public.boost_impressions
    where boost_id = p_boost and day = v_today;

  v_room_budget := b.budget_mmk - b.spent_mmk;
  v_room_daily := b.daily_cap_mmk - v_spent_today;
  v_charge := least(b.bid_mmk, v_room_budget, v_room_daily);
  if v_charge < 0 then
    v_charge := 0;
  end if;

  insert into public.boost_impressions
    (boost_id, viewer_id, day, shows, charge_mmk)
    values (p_boost, auth.uid(), v_today, 1, v_charge);

  update public.boosts
    set spent_mmk = spent_mmk + v_charge,
        impressions = impressions + 1,
        reach = reach + 1,
        status = case
          when spent_mmk + v_charge >= budget_mmk then 'completed'::public.boost_status
          else status
        end
    where id = p_boost;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_boost_click — free engagement signal that feeds pCTR
-- ---------------------------------------------------------------------------
create or replace function public.record_boost_click(p_boost uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Yangon')::date;
begin
  if auth.uid() is null then
    return;
  end if;
  -- Only count a click from someone who was served today, once.
  update public.boost_impressions
    set clicked = true
    where boost_id = p_boost and viewer_id = auth.uid() and day = v_today
      and not clicked;
  if found then
    update public.boosts set clicks = clicks + 1 where id = p_boost;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_boost_status — owner pause / resume
-- ---------------------------------------------------------------------------
create or replace function public.set_boost_status(
  p_boost uuid,
  p_status public.boost_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.boosts;
begin
  select * into b from public.boosts where id = p_boost;
  if not found or b.owner_id <> auth.uid() then
    raise exception 'Not your campaign';
  end if;
  -- Owners may only toggle between active and paused.
  if p_status not in ('active', 'paused')
     or b.status not in ('active', 'paused') then
    raise exception 'Cannot change this campaign to that state';
  end if;
  update public.boosts set status = p_status where id = p_boost;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_boost — stop and refund the unspent remainder to G-Pay
-- ---------------------------------------------------------------------------
create or replace function public.cancel_boost(p_boost uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.boosts;
  v_acct uuid;
  v_refund numeric(12, 2);
begin
  select * into b from public.boosts where id = p_boost;
  if not found or b.owner_id <> auth.uid() then
    raise exception 'Not your campaign';
  end if;
  if b.status in ('completed', 'cancelled') then
    raise exception 'Campaign is already finished';
  end if;

  v_refund := b.budget_mmk - b.spent_mmk;
  update public.boosts
    set status = 'cancelled', budget_mmk = spent_mmk
    where id = p_boost;

  if v_refund > 0 then
    select id into v_acct
      from public.gpay_accounts
      where user_id = auth.uid() and status = 'active';
    if v_acct is not null then
      perform set_config('gpay.allow_ledger', 'on', true);
      update public.gpay_accounts
        set balance = balance + v_refund where id = v_acct;
      insert into public.gpay_transactions (kind, to_account, amount, note)
        values ('topup', v_acct, v_refund, 'Boost refund');
      perform set_config('gpay.allow_ledger', 'off', true);
    end if;
  end if;

  return coalesce(v_refund, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_feed_boosts — the serving query (SECURITY DEFINER, viewer-safe columns)
-- ---------------------------------------------------------------------------
-- Returns the campaigns eligible to show to the current viewer for a target
-- type: active, inside their schedule, with budget and daily-cap headroom,
-- not the viewer's own, and not already shown to them p_freq_cap times today.
-- The application layer scores these (bid × pCTR × pacing) and picks winners.
create or replace function public.get_feed_boosts(
  p_target_type public.boost_target,
  p_limit integer default 10,
  p_freq_cap integer default 4
)
returns table (
  id uuid,
  owner_id uuid,
  target_id uuid,
  headline text,
  bid_mmk numeric,
  budget_mmk numeric,
  spent_mmk numeric,
  daily_cap_mmk numeric,
  spent_today numeric,
  impressions integer,
  clicks integer,
  start_at timestamptz,
  end_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select boost_id, coalesce(sum(charge_mmk), 0) as spent_today
    from public.boost_impressions
    where day = (now() at time zone 'Asia/Yangon')::date
    group by boost_id
  ),
  seen as (
    select boost_id, coalesce(sum(shows), 0) as shows
    from public.boost_impressions
    where day = (now() at time zone 'Asia/Yangon')::date
      and viewer_id = auth.uid()
    group by boost_id
  )
  select
    b.id, b.owner_id, b.target_id, b.headline,
    b.bid_mmk, b.budget_mmk, b.spent_mmk, b.daily_cap_mmk,
    coalesce(t.spent_today, 0) as spent_today,
    b.impressions, b.clicks, b.start_at, b.end_at
  from public.boosts b
  left join today t on t.boost_id = b.id
  left join seen s on s.boost_id = b.id
  where b.target_type = p_target_type
    and b.status = 'active'
    and now() >= b.start_at
    and now() < b.end_at
    and b.spent_mmk < b.budget_mmk
    and coalesce(t.spent_today, 0) < b.daily_cap_mmk
    and b.owner_id is distinct from auth.uid()
    and coalesce(s.shows, 0) < greatest(1, p_freq_cap)
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

-- ---------------------------------------------------------------------------
-- boost_daily_stats — per-day performance of one campaign (owner analytics)
-- ---------------------------------------------------------------------------
create or replace function public.boost_daily_stats(
  p_boost uuid,
  p_days integer default 30
)
returns table (
  day date,
  impressions bigint,
  clicks bigint,
  spent numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    bi.day,
    count(*) filter (where bi.charge_mmk > 0 or bi.shows > 0) as impressions,
    count(*) filter (where bi.clicked) as clicks,
    coalesce(sum(bi.charge_mmk), 0) as spent
  from public.boost_impressions bi
  join public.boosts b on b.id = bi.boost_id
  where bi.boost_id = p_boost
    and b.owner_id = auth.uid()
    and bi.day >= (now() at time zone 'Asia/Yangon')::date
                  - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  group by bi.day
  order by bi.day;
$$;

grant execute on function public.owns_boost_target(public.boost_target, uuid) to authenticated;
grant execute on function public.create_boost(public.boost_target, uuid, text, numeric, numeric, numeric, integer, jsonb) to authenticated;
grant execute on function public.record_boost_impression(uuid) to authenticated;
grant execute on function public.record_boost_click(uuid) to authenticated;
grant execute on function public.set_boost_status(uuid, public.boost_status) to authenticated;
grant execute on function public.cancel_boost(uuid) to authenticated;
grant execute on function public.get_feed_boosts(public.boost_target, integer, integer) to authenticated;
grant execute on function public.boost_daily_stats(uuid, integer) to authenticated;
