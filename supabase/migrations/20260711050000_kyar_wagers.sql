-- Extend the G-Pay wager system (chess_wagers) to also cover the
-- traditional Myanmar ကျားထိုး (kyar) messenger game. Same escrow,
-- mutual-confirmation settlement, live broadcast and spectator
-- monetization — a `game` discriminator picks the board.

alter table public.chess_wagers
  add column if not exists game text not null default 'chess'
    check (game in ('chess', 'kyar'));

create index if not exists chess_wagers_game_idx
  on public.chess_wagers (game, created_at desc);

-- ---------------------------------------------------------------------------
-- create_chess_wager — add p_game (signature change, so drop the old one)
-- ---------------------------------------------------------------------------
drop function if exists public.create_chess_wager(uuid, numeric, boolean);

create or replace function public.create_chess_wager(
  p_conversation_id uuid,
  p_stake_mmk numeric,
  p_is_live boolean default false,
  p_game text default 'chess'
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
  if p_game is null or p_game not in ('chess', 'kyar') then
    raise exception 'Unknown wager game';
  end if;
  if p_stake_mmk is null or p_stake_mmk < 100
     or p_stake_mmk <> round(p_stake_mmk, 2) then
    raise exception 'Minimum stake is 100 MMK';
  end if;
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'You are not part of this conversation';
  end if;

  -- Only one live/pending wager per conversation at a time (any game),
  -- so escrowed money in a chat is always unambiguous.
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
    values ('fee', v_acct.id, p_stake_mmk,
            case p_game when 'kyar' then 'Kyar wager stake'
                        else 'Chess wager stake' end);
  perform set_config('gpay.allow_ledger', 'off', true);

  insert into public.chess_wagers
    (conversation_id, host_id, stake_mmk, is_live, pot_mmk, game)
    values (p_conversation_id, auth.uid(), p_stake_mmk,
            coalesce(p_is_live, false), p_stake_mmk, p_game)
    returning id into v_wager;

  return v_wager;
end;
$$;

-- ---------------------------------------------------------------------------
-- list_live_wagers — expose the game so the arena can label matches
-- ---------------------------------------------------------------------------
drop function if exists public.list_live_wagers(integer);

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
  game text,
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
    w.stake_mmk, w.pot_mmk, w.game, w.created_at
  from public.chess_wagers w
  join public.profiles hp on hp.id = w.host_id
  left join public.profiles gp on gp.id = w.guest_id
  where w.is_live and w.status = 'active'
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
