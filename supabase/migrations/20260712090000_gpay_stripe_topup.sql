-- G-Pay cash-in via Stripe. A member pays with an international card/bank through
-- Stripe Checkout; on the verified webhook this function credits their wallet.
--
-- SECURITY DEFINER + the gpay.allow_ledger flag so the balance guard trigger
-- permits the credit. Idempotent on the Stripe session id (stored in
-- gpay_transactions.reference) so a retried/duplicated webhook can't double-credit.

create or replace function public.gpay_stripe_topup(
  p_user uuid,
  p_amount numeric,
  p_ref text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct public.gpay_accounts;
begin
  if p_amount is null or p_amount < 0.01 then
    raise exception 'Invalid top-up amount';
  end if;

  -- Idempotency: this Stripe session was already credited.
  if p_ref is not null and exists (
    select 1 from public.gpay_transactions where reference = p_ref
  ) then
    return;
  end if;

  select * into v_acct
    from public.gpay_accounts
    where user_id = p_user and status = 'active';
  if not found then
    raise exception 'No active G-Pay account for that user';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance + p_amount where id = v_acct.id;
  insert into public.gpay_transactions
    (kind, from_account, to_account, amount, note, reference)
    values ('topup', null, v_acct.id, p_amount, 'Stripe top-up', p_ref);
end;
$$;

-- Called only by the webhook via the service-role client.
grant execute on function public.gpay_stripe_topup(uuid, numeric, text) to service_role;
