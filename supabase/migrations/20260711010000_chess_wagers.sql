-- Chess wagers — play a Messenger chess match for real G-Pay stakes.
--
-- Money model (play-money MMK, same wallet as G-Pay):
--   * The host opens a wager and their stake is *escrowed* out of their G-Pay
--     wallet immediately (create_chess_wager). Status is 'open'.
--   * The opponent accepts and their equal stake is escrowed too
--     (accept_chess_wager). Status becomes 'active' and the pot = 2 × stake.
--   * When the game ends, BOTH players report the outcome
--     (report_chess_result). If the two reports agree the wager auto-settles;
--     if they disagree it goes to 'disputed' for an admin to resolve. This
--     mutual-confirmation rule stops either side from unilaterally claiming the
--     pot.
--   * On a win the winner is paid pot − rake (default 1%); the rake is retained
--     by the platform. On a draw both stakes are refunded in full (no rake).
--   * The host may cancel an 'open' wager (no opponent yet) for a full refund.
--
-- Live broadcast: either player can flag the match `is_live`. Live matches are
-- listed publicly (list_live_wagers) and their board is mirrored to spectators
-- over a public realtime channel by the players' clients — read-only viewing.
--
-- Balances/ledger change only inside SECURITY DEFINER functions that flip the
-- gpay.allow_ledger flag, exactly like boosts and reels payouts.

create type public.chess_wager_status as enum
  ('open', 'active', 'settled', 'cancelled', 'disputed');
create type public.chess_wager_result as enum
  ('host_win', 'guest_win', 'draw');

create table public.chess_wagers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  guest_id uuid references public.profiles (id) on delete set null,

  stake_mmk numeric(12, 2) not null check (stake_mmk >= 100),
  rake_bps integer not null default 100 check (rake_bps between 0 and 2000),

  status public.chess_wager_status not null default 'open',
  is_live boolean not null default false,

  -- Mutual-confirmation outcome reports.
  host_result public.chess_wager_result,
  guest_result public.chess_wager_result,
  result public.chess_wager_result,

  pot_mmk numeric(12, 2) not null default 0,
  rake_mmk numeric(12, 2) not null default 0,
  payout_mmk numeric(12, 2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz
);

create index chess_wagers_conversation_idx
  on public.chess_wagers (conversation_id, created_at desc);
create index chess_wagers_host_idx on public.chess_wagers (host_id, created_at desc);
create index chess_wagers_guest_idx on public.chess_wagers (guest_id, created_at desc);
-- Public "live now" listing.
create index chess_wagers_live_idx
  on public.chess_wagers (status, created_at desc)
  where is_live and status = 'active';

create trigger chess_wagers_set_updated_at
  before update on public.chess_wagers
  for each row execute function public.handle_updated_at();

alter table public.chess_wagers enable row level security;

-- Players and admins read their own wagers; anyone may read a match that is
-- being live-broadcast (so spectators can load its metadata). Writes go only
-- through the SECURITY DEFINER RPCs below.
create policy "chess_wagers read" on public.chess_wagers
  for select
  to authenticated
  using (
    is_live
    or host_id = auth.uid()
    or guest_id = auth.uid()
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Helper: is the caller a member of this conversation?
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- create_chess_wager — host opens a wager and escrows their stake
-- ---------------------------------------------------------------------------
create or replace function public.create_chess_wager(
  p_conversation_id uuid,
  p_stake_mmk numeric,
  p_is_live boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct public.gpay_accounts;
  v_wager uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_stake_mmk is null or p_stake_mmk < 100
     or p_stake_mmk <> round(p_stake_mmk, 2) then
    raise exception 'Minimum stake is 100 MMK';
  end if;
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'You are not part of this conversation';
  end if;

  -- Only one live/pending wager per conversation at a time.
  if exists (
    select 1 from public.chess_wagers
    where conversation_id = p_conversation_id and status in ('open', 'active')
  ) then
    raise exception 'A wager is already in progress in this chat';
  end if;

  select * into v_acct
    from public.gpay_accounts
    where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'An active G-Pay account is required to wager';
  end if;
  if v_acct.balance < p_stake_mmk then
    raise exception 'Insufficient G-Pay balance for this stake';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts
    set balance = balance - p_stake_mmk where id = v_acct.id;
  insert into public.gpay_transactions (kind, from_account, amount, note)
    values ('fee', v_acct.id, p_stake_mmk, 'Chess wager stake');
  perform set_config('gpay.allow_ledger', 'off', true);

  insert into public.chess_wagers
    (conversation_id, host_id, stake_mmk, is_live, pot_mmk)
    values (p_conversation_id, auth.uid(), p_stake_mmk,
            coalesce(p_is_live, false), p_stake_mmk)
    returning id into v_wager;

  return v_wager;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_chess_wager — opponent matches the stake; the match goes live
-- ---------------------------------------------------------------------------
create or replace function public.accept_chess_wager(p_wager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.chess_wagers;
  v_acct public.gpay_accounts;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into w from public.chess_wagers where id = p_wager for update;
  if not found or w.status <> 'open' then
    raise exception 'This wager is not open';
  end if;
  if w.host_id = auth.uid() then
    raise exception 'You cannot accept your own wager';
  end if;
  if w.guest_id is not null then
    raise exception 'This wager already has an opponent';
  end if;
  if not public.is_conversation_member(w.conversation_id) then
    raise exception 'You are not part of this conversation';
  end if;

  select * into v_acct
    from public.gpay_accounts
    where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'An active G-Pay account is required to wager';
  end if;
  if v_acct.balance < w.stake_mmk then
    raise exception 'Insufficient G-Pay balance to match this stake';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts
    set balance = balance - w.stake_mmk where id = v_acct.id;
  insert into public.gpay_transactions (kind, from_account, amount, note)
    values ('fee', v_acct.id, w.stake_mmk, 'Chess wager stake');
  perform set_config('gpay.allow_ledger', 'off', true);

  update public.chess_wagers
    set guest_id = auth.uid(),
        status = 'active',
        pot_mmk = w.stake_mmk * 2
    where id = p_wager;
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: pay out a settled wager (winner gets pot − rake; draw refunds both)
-- ---------------------------------------------------------------------------
create or replace function public.settle_chess_wager_internal(
  p_wager uuid,
  p_result public.chess_wager_result
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.chess_wagers;
  v_pot numeric(12, 2);
  v_rake numeric(12, 2) := 0;
  v_payout numeric(12, 2) := 0;
  v_host_acct uuid;
  v_guest_acct uuid;
  v_winner_acct uuid;
begin
  select * into w from public.chess_wagers where id = p_wager for update;
  if not found then
    raise exception 'Wager not found';
  end if;
  if w.status not in ('active', 'disputed') then
    raise exception 'Wager cannot be settled from its current state';
  end if;

  v_pot := w.stake_mmk * 2;
  select id into v_host_acct from public.gpay_accounts where user_id = w.host_id;
  select id into v_guest_acct from public.gpay_accounts where user_id = w.guest_id;

  perform set_config('gpay.allow_ledger', 'on', true);
  if p_result = 'draw' then
    -- Refund each stake in full; no rake on a draw.
    if v_host_acct is not null then
      update public.gpay_accounts set balance = balance + w.stake_mmk
        where id = v_host_acct;
      insert into public.gpay_transactions (kind, to_account, amount, note)
        values ('topup', v_host_acct, w.stake_mmk, 'Chess wager draw refund');
    end if;
    if v_guest_acct is not null then
      update public.gpay_accounts set balance = balance + w.stake_mmk
        where id = v_guest_acct;
      insert into public.gpay_transactions (kind, to_account, amount, note)
        values ('topup', v_guest_acct, w.stake_mmk, 'Chess wager draw refund');
    end if;
  else
    v_rake := round(v_pot * w.rake_bps / 10000.0, 2);
    v_payout := v_pot - v_rake;
    v_winner_acct := case when p_result = 'host_win' then v_host_acct
                          else v_guest_acct end;
    if v_winner_acct is not null then
      update public.gpay_accounts set balance = balance + v_payout
        where id = v_winner_acct;
      insert into public.gpay_transactions (kind, to_account, amount, note)
        values ('topup', v_winner_acct, v_payout, 'Chess wager winnings');
    end if;
    -- Record the platform rake for the admin ledger.
    if v_rake > 0 then
      insert into public.gpay_transactions (kind, amount, note)
        values ('fee', v_rake, 'Chess wager rake');
    end if;
  end if;
  perform set_config('gpay.allow_ledger', 'off', true);

  update public.chess_wagers
    set status = 'settled',
        result = p_result,
        rake_mmk = v_rake,
        payout_mmk = v_payout,
        settled_at = now()
    where id = p_wager;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_chess_result — each player reports the outcome; agree → auto-settle
-- ---------------------------------------------------------------------------
create or replace function public.report_chess_result(
  p_wager uuid,
  p_result public.chess_wager_result
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.chess_wagers;
  v_host public.chess_wager_result;
  v_guest public.chess_wager_result;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into w from public.chess_wagers where id = p_wager for update;
  if not found or w.status <> 'active' then
    raise exception 'This wager is not awaiting a result';
  end if;
  if auth.uid() not in (w.host_id, w.guest_id) then
    raise exception 'You are not a player in this wager';
  end if;

  if auth.uid() = w.host_id then
    update public.chess_wagers set host_result = p_result where id = p_wager;
  else
    update public.chess_wagers set guest_result = p_result where id = p_wager;
  end if;

  select host_result, guest_result into v_host, v_guest
    from public.chess_wagers where id = p_wager;

  if v_host is not null and v_guest is not null then
    if v_host = v_guest then
      perform public.settle_chess_wager_internal(p_wager, v_host);
      return 'settled';
    else
      update public.chess_wagers set status = 'disputed' where id = p_wager;
      return 'disputed';
    end if;
  end if;
  return 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_chess_wager — host cancels an open (unmatched) wager, refunded
-- ---------------------------------------------------------------------------
create or replace function public.cancel_chess_wager(p_wager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.chess_wagers;
  v_acct uuid;
begin
  select * into w from public.chess_wagers where id = p_wager for update;
  if not found or w.host_id <> auth.uid() then
    raise exception 'Not your wager';
  end if;
  if w.status <> 'open' then
    raise exception 'Only an open wager (no opponent yet) can be cancelled';
  end if;

  select id into v_acct from public.gpay_accounts where user_id = w.host_id;
  if v_acct is not null then
    perform set_config('gpay.allow_ledger', 'on', true);
    update public.gpay_accounts set balance = balance + w.stake_mmk
      where id = v_acct;
    insert into public.gpay_transactions (kind, to_account, amount, note)
      values ('topup', v_acct, w.stake_mmk, 'Chess wager cancelled');
    perform set_config('gpay.allow_ledger', 'off', true);
  end if;

  update public.chess_wagers set status = 'cancelled' where id = p_wager;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_chess_wager_live — either player toggles the live broadcast
-- ---------------------------------------------------------------------------
create or replace function public.set_chess_wager_live(
  p_wager uuid,
  p_live boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.chess_wagers;
begin
  select * into w from public.chess_wagers where id = p_wager;
  if not found or auth.uid() not in (w.host_id, w.guest_id) then
    raise exception 'Not your wager';
  end if;
  if w.status not in ('open', 'active') then
    raise exception 'This match is no longer running';
  end if;
  update public.chess_wagers set is_live = coalesce(p_live, false) where id = p_wager;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_settle_chess_wager — resolve a disputed match
-- ---------------------------------------------------------------------------
create or replace function public.admin_settle_chess_wager(
  p_wager uuid,
  p_result public.chess_wager_result
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  perform public.settle_chess_wager_internal(p_wager, p_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- list_live_wagers — public "watch live" board directory
-- ---------------------------------------------------------------------------
create or replace function public.list_live_wagers(p_limit integer default 30)
returns table (
  id uuid,
  conversation_id uuid,
  host_id uuid,
  host_name text,
  host_username text,
  host_avatar text,
  guest_id uuid,
  guest_name text,
  guest_username text,
  guest_avatar text,
  stake_mmk numeric,
  pot_mmk numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id, w.conversation_id,
    w.host_id, hp.full_name, hp.username, hp.avatar_url,
    w.guest_id, gp.full_name, gp.username, gp.avatar_url,
    w.stake_mmk, w.pot_mmk, w.created_at
  from public.chess_wagers w
  join public.profiles hp on hp.id = w.host_id
  left join public.profiles gp on gp.id = w.guest_id
  where w.is_live and w.status = 'active'
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

-- ---------------------------------------------------------------------------
-- Spectator monetization
-- ---------------------------------------------------------------------------
-- A host who has enrolled in monetization earns play-money for each unique
-- spectator who watches their live wager match — the same creator_earnings
-- ledger reels use, so it withdraws through withdraw_reel_earnings. Views are
-- always counted; money accrues only when the host has monetization enabled.

alter table public.profiles
  add column if not exists monetization_enabled boolean not null default false;

create table public.chess_wager_views (
  wager_id uuid not null references public.chess_wagers (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wager_id, viewer_id)
);

alter table public.chess_wagers
  add column if not exists spectators integer not null default 0;

alter table public.chess_wager_views enable row level security;

-- Spectator rows are private plumbing — only admins read them directly.
create policy "chess_wager_views admin read" on public.chess_wager_views
  for select to authenticated using (public.is_admin());

-- The caller enrolls in / opts out of monetization (self-attested; an admin can
-- also flip it off if the account abuses it).
create or replace function public.set_monetization(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  update public.profiles
    set monetization_enabled = coalesce(p_enabled, false)
    where id = auth.uid();
end;
$$;

-- Count a unique spectator on a live match and, if the host is monetized,
-- credit them. Players watching their own match are never counted or paid.
create or replace function public.record_wager_view(p_wager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.chess_wagers;
  v_monetized boolean;
begin
  if auth.uid() is null then
    return;
  end if;
  select * into w from public.chess_wagers where id = p_wager;
  if not found or not w.is_live or w.status <> 'active' then
    return;
  end if;
  if auth.uid() in (w.host_id, coalesce(w.guest_id, w.host_id)) then
    return; -- players don't count as spectators
  end if;

  insert into public.chess_wager_views (wager_id, viewer_id)
    values (p_wager, auth.uid())
    on conflict do nothing;
  if not found then
    return; -- already counted this spectator
  end if;

  update public.chess_wagers set spectators = spectators + 1 where id = p_wager;

  select monetization_enabled into v_monetized
    from public.profiles where id = w.host_id;
  if coalesce(v_monetized, false) then
    insert into public.creator_earnings (user_id, kind, amount_mmk)
      values (w.host_id, 'view', 1.00);
  end if;
end;
$$;

grant execute on function public.set_monetization(boolean) to authenticated;
grant execute on function public.record_wager_view(uuid) to authenticated;

grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.create_chess_wager(uuid, numeric, boolean) to authenticated;
grant execute on function public.accept_chess_wager(uuid) to authenticated;
grant execute on function public.settle_chess_wager_internal(uuid, public.chess_wager_result) to authenticated;
grant execute on function public.report_chess_result(uuid, public.chess_wager_result) to authenticated;
grant execute on function public.cancel_chess_wager(uuid) to authenticated;
grant execute on function public.set_chess_wager_live(uuid, boolean) to authenticated;
grant execute on function public.admin_settle_chess_wager(uuid, public.chess_wager_result) to authenticated;
grant execute on function public.list_live_wagers(integer) to authenticated;
