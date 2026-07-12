-- G-Pay security upgrade toward international payment standards:
--   • Transaction PIN (bcrypt) required to send money — stored in a locked-down
--     table so the hash of a short numeric PIN is NEVER exposed to any client
--     (that would be trivially brute-forceable). Only SECURITY DEFINER money
--     functions read it.
--   • Idempotency keys on transfers — a client retry can't double-spend.
--   • Human-readable reference numbers on every transfer (audit / receipts).
--
-- pgcrypto (crypt / gen_salt) lives in the `extensions` schema on Supabase, so
-- the money functions add it to their search_path.

-- ---------------------------------------------------------------------------
-- PIN vault — RLS on, and intentionally NO policies, so PostgREST/clients can
-- never read or write it directly. The SECURITY DEFINER functions below own the
-- only access path.
-- ---------------------------------------------------------------------------
create table if not exists public.gpay_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.gpay_pins enable row level security;
revoke all on public.gpay_pins from anon, authenticated;

-- Idempotency + reference columns on the ledger.
alter table public.gpay_transactions
  add column if not exists reference text,
  add column if not exists client_ref text;

-- One transfer per (sender, client_ref): a retry with the same key is a no-op.
create unique index if not exists gpay_txn_idem_idx
  on public.gpay_transactions (from_account, client_ref)
  where client_ref is not null;

-- ---------------------------------------------------------------------------
-- Set / change the caller's transaction PIN (4–6 digits).
-- ---------------------------------------------------------------------------
create or replace function public.gpay_set_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;
  insert into public.gpay_pins (user_id, pin_hash, updated_at)
    values (auth.uid(), crypt(p_pin, gen_salt('bf')), now())
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

grant execute on function public.gpay_set_pin(text) to authenticated;

-- Whether the caller has a PIN set (so the UI can prompt to create one).
create or replace function public.gpay_has_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gpay_pins where user_id = auth.uid());
$$;

grant execute on function public.gpay_has_pin() to authenticated;

-- ---------------------------------------------------------------------------
-- Rebuild gpay_transfer with PIN verification, idempotency and a reference.
-- Old 3-arg version is dropped so the new one (with defaults) is unambiguous.
-- ---------------------------------------------------------------------------
drop function if exists public.gpay_transfer(text, numeric, text);

create or replace function public.gpay_transfer(
  p_to_phone text,
  p_amount numeric,
  p_note text default null,
  p_pin text default null,
  p_client_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_from public.gpay_accounts;
  v_to public.gpay_accounts;
  v_hash text;
  v_txn uuid;
  v_existing uuid;
  v_ref text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount < 0.01 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid amount (at least 0.01, up to 2 decimals)';
  end if;

  select * into v_from from public.gpay_accounts where user_id = auth.uid();
  if not found then
    raise exception 'You do not have a G-Pay account';
  end if;
  if v_from.status <> 'active' then
    raise exception 'Your G-Pay account is not active yet';
  end if;

  -- Idempotency: if this exact request already ran, return its transaction.
  if p_client_ref is not null then
    select id into v_existing
      from public.gpay_transactions
      where from_account = v_from.id and client_ref = p_client_ref;
    if found then
      return v_existing;
    end if;
  end if;

  -- PIN gate: if the sender has set a PIN, it must be provided and correct.
  select pin_hash into v_hash from public.gpay_pins where user_id = auth.uid();
  if v_hash is not null then
    if p_pin is null then
      raise exception 'PIN required';
    end if;
    if crypt(p_pin, v_hash) <> v_hash then
      raise exception 'Incorrect PIN';
    end if;
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

  v_ref := 'GP' || to_char(now(), 'YYMMDD') ||
           upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - p_amount where id = v_from.id;
  update public.gpay_accounts set balance = balance + p_amount where id = v_to.id;
  insert into public.gpay_transactions
    (kind, from_account, to_account, amount, note, reference, client_ref)
    values ('transfer', v_from.id, v_to.id, p_amount, p_note, v_ref, p_client_ref)
    returning id into v_txn;
  return v_txn;
end;
$$;

grant execute on function
  public.gpay_transfer(text, numeric, text, text, text) to authenticated;
