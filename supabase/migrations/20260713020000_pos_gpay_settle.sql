-- Real in-store G-Pay settlement for the POS.
--
-- Until now a POS sale could record 'gpay' as a tender label, but no money
-- actually moved — only the online Shop settled real G-Pay. This adds an
-- atomic, PIN-gated settlement so a shop (ops) can take real G-Pay at the
-- counter: the customer authorises with their own transaction PIN, their
-- wallet is debited and the store owner's wallet is credited, in one
-- transaction that rolls back entirely on any failure.

create or replace function public.pos_settle_gpay(
  p_store_id uuid,
  p_customer_phone text,
  p_amount numeric,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_store public.gpay_accounts;
  v_cust public.gpay_accounts;
  v_txn uuid;
begin
  -- Only a member of this store (owner or staff) may take payment for it.
  if auth.uid() is null or not public.is_store_member(p_store_id) then
    raise exception 'Not authorized for this store';
  end if;
  if p_amount is null or p_amount < 0.01 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid amount';
  end if;

  select owner_id into v_owner from public.stores where id = p_store_id;
  if v_owner is null then
    raise exception 'Store not found';
  end if;

  -- Credit target: the store owner's active wallet.
  select * into v_store from public.gpay_accounts
    where user_id = v_owner and status = 'active';
  if not found then
    raise exception 'The store owner needs an active G-Pay account';
  end if;

  -- Debit source: the paying customer, found by their G-Pay phone.
  select * into v_cust from public.gpay_accounts
    where phone = p_customer_phone and status = 'active';
  if not found then
    raise exception 'No active G-Pay account for that phone number';
  end if;
  if v_cust.id = v_store.id then
    raise exception 'Customer and store cannot be the same account';
  end if;

  -- The customer authorises the charge with their own transaction PIN.
  if not exists (
    select 1 from public.gpay_pins
    where user_id = v_cust.user_id and pin_hash = crypt(p_pin, pin_hash)
  ) then
    raise exception 'Wrong customer PIN (or the customer has not set one)';
  end if;

  if v_cust.balance < p_amount then
    raise exception 'Insufficient customer balance';
  end if;

  -- Move the money (the balance guard trigger requires this flag).
  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - p_amount where id = v_cust.id;
  update public.gpay_accounts set balance = balance + p_amount where id = v_store.id;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('transfer', v_cust.id, v_store.id, p_amount, 'POS sale')
    returning id into v_txn;

  return v_txn;
end;
$$;

grant execute on function public.pos_settle_gpay(uuid, text, numeric, text)
  to authenticated;
