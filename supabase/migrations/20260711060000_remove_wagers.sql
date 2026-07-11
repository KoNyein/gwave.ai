-- Remove the real-money game wagering (gambling) feature for Play Store
-- policy compliance. Escrowed stakes on any open/active wager are refunded
-- to the players before the tables are dropped. The G-Pay wallet itself,
-- reels creator monetization (set_monetization, profiles.monetization_enabled,
-- creator_earnings) and all games as free-to-play are unaffected.

-- ---------------------------------------------------------------------------
-- 1. Refund outstanding escrow (open: host stake; active: both stakes)
-- ---------------------------------------------------------------------------
do $$
declare
  w record;
begin
  if to_regclass('public.chess_wagers') is null then
    return;
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  for w in
    select * from public.chess_wagers where status in ('open', 'active', 'disputed')
  loop
    -- host always has a stake in escrow
    update public.gpay_accounts
      set balance = balance + w.stake_mmk
      where user_id = w.host_id and status = 'active';
    insert into public.gpay_transactions (kind, to_account, amount, note)
      select 'topup', a.id, w.stake_mmk, 'Wager feature removed — stake refunded'
      from public.gpay_accounts a
      where a.user_id = w.host_id and a.status = 'active';

    -- guest has a stake once the wager became active/disputed
    if w.guest_id is not null and w.status in ('active', 'disputed') then
      update public.gpay_accounts
        set balance = balance + w.stake_mmk
        where user_id = w.guest_id and status = 'active';
      insert into public.gpay_transactions (kind, to_account, amount, note)
        select 'topup', a.id, w.stake_mmk, 'Wager feature removed — stake refunded'
        from public.gpay_accounts a
        where a.user_id = w.guest_id and a.status = 'active';
    end if;
  end loop;
  perform set_config('gpay.allow_ledger', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Drop wager functions (keep set_monetization — reels still use it)
-- ---------------------------------------------------------------------------
drop function if exists public.create_chess_wager(uuid, numeric, boolean, text);
drop function if exists public.create_chess_wager(uuid, numeric, boolean);
drop function if exists public.accept_chess_wager(uuid);
drop function if exists public.settle_chess_wager_internal(uuid, public.chess_wager_result);
drop function if exists public.report_chess_result(uuid, public.chess_wager_result);
drop function if exists public.cancel_chess_wager(uuid);
drop function if exists public.set_chess_wager_live(uuid, boolean);
drop function if exists public.admin_settle_chess_wager(uuid, public.chess_wager_result);
drop function if exists public.list_live_wagers(integer);
drop function if exists public.record_wager_view(uuid);

-- ---------------------------------------------------------------------------
-- 3. Drop wager tables and types
-- ---------------------------------------------------------------------------
drop table if exists public.chess_wager_views;
drop table if exists public.chess_wagers;
drop type if exists public.chess_wager_status;
drop type if exists public.chess_wager_result;
