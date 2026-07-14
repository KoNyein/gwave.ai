-- ============================================================================
-- Repeg G-Pay to the US Dollar — international standard, stable store of value.
--
-- Was: 1 G-Pay = 1 MMK (Myanmar Kyat). Now: 1 G-Pay = 1 USD.
--
-- Every stored G-Pay amount (wallet balances, the ledger, boost escrow) is
-- converted MMK -> USD at the live rate so no member's real value changes
-- (e.g. 45,000 "Ks" -> ~$10). Absolute MMK minimums/bonuses baked into the
-- money functions are restated in USD. The rate table itself is untouched, so
-- gpay_convert(x,'MMK','USD') still divides by the current MMK-per-USD rate.
--
-- Note: the *_mmk column names are kept (renaming cascades widely); after this
-- migration they hold USD. New code treats G-Pay as USD via GPAY_PEG_CODE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Relax the boost budget floor before converting (old floor was 100 MMK; a
--    converted budget is far smaller, and the new floor is $1).
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.boosts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%budget_mmk%>=%100%'
  loop
    execute format('alter table public.boosts drop constraint %I', c.conname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Convert every stored G-Pay amount MMK -> USD (round to cents).
-- ---------------------------------------------------------------------------
update public.gpay_accounts
  set balance = round(public.gpay_convert(balance, 'MMK', 'USD'), 2)
  where balance <> 0;

update public.gpay_transactions
  set amount = round(public.gpay_convert(amount, 'MMK', 'USD'), 2)
  where amount is not null and amount <> 0;

update public.boosts set
  budget_mmk    = round(public.gpay_convert(budget_mmk,    'MMK', 'USD'), 2),
  spent_mmk     = round(public.gpay_convert(spent_mmk,     'MMK', 'USD'), 2),
  daily_cap_mmk = round(public.gpay_convert(daily_cap_mmk, 'MMK', 'USD'), 2),
  bid_mmk       = round(public.gpay_convert(bid_mmk,       'MMK', 'USD'), 2);

-- ---------------------------------------------------------------------------
-- 3) Repeg the convenience wrappers: G-Pay is now USD, not MMK.
-- ---------------------------------------------------------------------------
create or replace function public.gpay_to_currency(gpay numeric, to_code text)
returns numeric language sql stable as $$
  select public.gpay_convert(gpay, 'USD', to_code);
$$;

create or replace function public.currency_to_gpay(amount numeric, from_code text)
returns numeric language sql stable as $$
  select public.gpay_convert(amount, from_code, 'USD');
$$;

-- ---------------------------------------------------------------------------
-- 4) Welcome bonus is credited into the wallet, so it must be a USD amount now
--    (1000 would mean $1000). One-time $1 on first activation.
-- ---------------------------------------------------------------------------
create or replace function public.gpay_set_status(
  p_account uuid,
  p_status public.gpay_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct public.gpay_accounts;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select * into v_acct from public.gpay_accounts where id = p_account for update;
  if not found then
    raise exception 'Account not found';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set status = p_status where id = p_account;

  -- One-time $1 welcome bonus on the first time an account becomes active.
  if p_status = 'active' and v_acct.welcomed_at is null then
    update public.gpay_accounts
      set balance = balance + 1,
          welcomed_at = now()
      where id = p_account;
    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('topup', null, p_account, 1, 'welcome bonus');
  end if;
end;
$$;

grant execute on function public.gpay_set_status(uuid, public.gpay_status) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Boost minimums in USD: min budget $1, min daily cap $0.50, min bid $0.01.
--    (Body is otherwise identical to the original create_boost.)
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

  -- Amounts must be sane, whole-cent numbers (now in USD).
  if p_budget_mmk is null or p_budget_mmk < 1
     or p_budget_mmk <> round(p_budget_mmk, 2) then
    raise exception 'Minimum boost budget is $1';
  end if;
  if p_daily_cap_mmk is null or p_daily_cap_mmk < 0.5
     or p_daily_cap_mmk > p_budget_mmk then
    raise exception 'Daily cap must be between $0.50 and the total budget';
  end if;
  if p_bid_mmk is null or p_bid_mmk < 0.01 or p_bid_mmk <> round(p_bid_mmk, 2) then
    raise exception 'Bid must be at least $0.01 per view';
  end if;

  if not public.owns_boost_target(p_target_type, p_target_id) then
    raise exception 'You can only boost your own content';
  end if;

  select * into v_acct
    from public.gpay_accounts
    where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'An active G-Pay account is required to boost';
  end if;
  if v_acct.balance < p_budget_mmk then
    raise exception 'Insufficient G-Pay balance for this budget';
  end if;

  -- Escrow: debit the wallet now and log a fee.
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
