-- ================================================================
-- G-Pay — mobile-money wallet setup
-- Copy this whole file into the Supabase SQL Editor and click "Run".
-- Creates the gpay_accounts + gpay_transactions tables, RLS policies,
-- the guard trigger, and the money functions (transfer / top-up / status).
-- Safe assumptions: the shared helpers is_admin(), is_suspended(),
-- handle_updated_at() already exist from earlier migrations.
-- ================================================================

-- G-Pay — a simple in-app mobile-money wallet.
--
-- Every member who wants to use G-Pay must first register a KYC profile:
-- their legal name, NRC (national ID), KPay number, email and at least one
-- messenger contact (Telegram or Viber), plus an address. A new account starts
-- as 'pending' and can neither send nor receive money until an admin reviews
-- the details and marks it 'active'. This is the "complete your details before
-- you may use it" gate.
--
-- Money never moves from the client. Balances and the transaction ledger are
-- changed only inside SECURITY DEFINER functions (gpay_transfer,
-- gpay_admin_topup, gpay_set_status). A guard trigger stops an account owner
-- from editing their own balance or approval status while still letting them
-- keep their KYC details up to date.

create type public.gpay_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.gpay_txn_kind as enum ('transfer', 'topup', 'withdraw', 'fee');

-- ---------------------------------------------------------------------------
-- Accounts (wallet + KYC)
-- ---------------------------------------------------------------------------
create table public.gpay_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  status public.gpay_status not null default 'pending',
  -- KYC details, all required except the two messenger handles (one of which
  -- is required by the check constraint below).
  full_name text not null check (char_length(full_name) between 2 and 120),
  nrc_number text not null unique check (char_length(nrc_number) between 4 and 40),
  -- The KPay / mobile-money number, also the handle others send money to.
  phone text not null unique check (char_length(phone) between 5 and 20),
  email text not null check (char_length(email) between 3 and 160),
  telegram text check (telegram is null or char_length(telegram) <= 80),
  viber text check (viber is null or char_length(viber) <= 40),
  address text not null check (char_length(address) between 3 and 300),
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- At least one messenger contact is mandatory.
  constraint gpay_needs_contact check (telegram is not null or viber is not null)
);

create index gpay_accounts_status_idx on public.gpay_accounts (status, created_at desc);

create trigger gpay_accounts_set_updated_at
  before update on public.gpay_accounts
  for each row execute function public.handle_updated_at();

-- Protect balance/status from direct owner edits. Trusted paths — the money
-- functions (which set the gpay.allow_ledger flag) and admins — may change
-- them; an ordinary owner update silently keeps the old values, so KYC edits
-- still work but self-crediting / self-approval cannot.
create or replace function public.gpay_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('gpay.allow_ledger', true) = 'on' or public.is_admin() then
    return new;
  end if;
  new.balance := old.balance;
  new.status := old.status;
  return new;
end;
$$;

create trigger gpay_accounts_protect
  before update on public.gpay_accounts
  for each row execute function public.gpay_protect_columns();

alter table public.gpay_accounts enable row level security;

-- Owners read their own account; admins read all (for the review queue).
create policy "Owner and admin read gpay accounts"
  on public.gpay_accounts
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Owners register their own account; it must start pending and empty.
create policy "Owner registers gpay account"
  on public.gpay_accounts
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and balance = 0
    and not public.is_suspended(auth.uid())
  );

-- Owners edit their own KYC (balance/status are pinned by the guard trigger);
-- admins may update any account.
create policy "Owner and admin update gpay accounts"
  on public.gpay_accounts
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Transaction ledger
-- ---------------------------------------------------------------------------
create table public.gpay_transactions (
  id uuid primary key default gen_random_uuid(),
  kind public.gpay_txn_kind not null,
  from_account uuid references public.gpay_accounts (id) on delete set null,
  to_account uuid references public.gpay_accounts (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index gpay_txn_from_idx on public.gpay_transactions (from_account, created_at desc);
create index gpay_txn_to_idx on public.gpay_transactions (to_account, created_at desc);

alter table public.gpay_transactions enable row level security;

-- A user reads a transaction if they own either side; admins read all. There
-- is no insert/update/delete policy — the ledger is written only by the RPCs.
create policy "Parties and admins read gpay transactions"
  on public.gpay_transactions
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.gpay_accounts a
      where a.id in (
        public.gpay_transactions.from_account,
        public.gpay_transactions.to_account
      )
        and a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Money functions (the only way balances change)
-- ---------------------------------------------------------------------------

-- Send money to another active account, addressed by its KPay/phone number.
-- Debits the caller and credits the recipient atomically after checking the
-- caller is active and has enough balance.
create or replace function public.gpay_transfer(
  p_to_phone text,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.gpay_accounts;
  v_to public.gpay_accounts;
  v_txn uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero';
  end if;

  select * into v_from from public.gpay_accounts where user_id = auth.uid();
  if not found then
    raise exception 'You do not have a G-Pay account';
  end if;
  if v_from.status <> 'active' then
    raise exception 'Your G-Pay account is not active yet';
  end if;

  select * into v_to
    from public.gpay_accounts
    where phone = p_to_phone and status = 'active';
  if not found then
    raise exception 'No active G-Pay account with that number';
  end if;
  if v_to.id = v_from.id then
    raise exception 'You cannot send money to yourself';
  end if;
  if v_from.balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - p_amount where id = v_from.id;
  update public.gpay_accounts set balance = balance + p_amount where id = v_to.id;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('transfer', v_from.id, v_to.id, p_amount, p_note)
    returning id into v_txn;
  return v_txn;
end;
$$;

-- Admin: credit an account (a cash-in / top-up) and log it.
create or replace function public.gpay_admin_topup(
  p_account uuid,
  p_amount numeric,
  p_note text default null
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
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero';
  end if;
  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance + p_amount where id = p_account;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('topup', null, p_account, p_amount, p_note);
end;
$$;

-- Admin: approve / suspend / reject an account after reviewing its KYC.
create or replace function public.gpay_set_status(
  p_account uuid,
  p_status public.gpay_status
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
  update public.gpay_accounts set status = p_status where id = p_account;
end;
$$;

grant execute on function public.gpay_transfer(text, numeric, text) to authenticated;
grant execute on function public.gpay_admin_topup(uuid, numeric, text) to authenticated;
grant execute on function public.gpay_set_status(uuid, public.gpay_status) to authenticated;
