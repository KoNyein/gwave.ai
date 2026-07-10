-- ================================================================
-- G-Pay — registration slip + welcome bonus patch
-- Copy into the Supabase SQL Editor and click "Run" (idempotent).
-- Adds slip_path + welcomed_at to gpay_accounts and updates
-- gpay_set_status() to grant a one-time 1,000 MMK welcome bonus on
-- first approval. Requires the earlier gpay-setup.sql to have been run.
-- ================================================================

-- G-Pay: payment-slip on registration + a one-time welcome bonus.
--
-- To open a G-Pay account a member transfers the registration fee over KPay and
-- uploads the slip as proof (stored in the existing private "slips" bucket; the
-- column holds the storage path, like the membership PromptPay slips). When an
-- admin first approves an account it is auto-credited a welcome bonus, so an
-- approved wallet already holds a starting balance. The bonus is one-time,
-- guarded by welcomed_at.

alter table public.gpay_accounts
  add column if not exists slip_path text
    check (slip_path is null or char_length(slip_path) <= 500);

alter table public.gpay_accounts
  add column if not exists welcomed_at timestamptz;

-- Replace gpay_set_status so first activation grants the welcome bonus.
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

  select * into v_acct from public.gpay_accounts where id = p_account;
  if not found then
    raise exception 'Account not found';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set status = p_status where id = p_account;

  -- One-time welcome bonus on the first time an account becomes active.
  if p_status = 'active' and v_acct.welcomed_at is null then
    update public.gpay_accounts
      set balance = balance + 1000,
          welcomed_at = now()
      where id = p_account;
    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('topup', null, p_account, 1000, 'welcome bonus');
  end if;
end;
$$;

grant execute on function public.gpay_set_status(uuid, public.gpay_status) to authenticated;
