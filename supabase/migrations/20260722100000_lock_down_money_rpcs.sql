-- Close an unauthenticated money-minting hole.
--
-- `gpay_stripe_topup(uuid, numeric, text)` is SECURITY DEFINER and runs
--   update public.gpay_accounts set balance = balance + p_amount ...
-- with **no auth.uid() check and no is_admin() check**. It was executable by
-- `anon`, so anyone on the internet could POST to
-- /sb/rest/v1/rpc/gpay_stripe_topup with any user id and any amount and credit
-- that account. Verified against production 2026-07-22.
--
-- It has exactly one legitimate caller — `src/app/api/webhooks/stripe/route.ts`,
-- which uses the admin client (service_role). So revoking anon/authenticated
-- breaks nothing: the webhook keeps working, and there is no client path.
--
-- `issue_invoice` is in the same shape (SECURITY DEFINER, anon-executable, no
-- auth guard found) and has no caller anywhere in src/ at all.
--
-- The sibling functions were checked in the same pass and are NOT included
-- because they already guard themselves: gpay_admin_topup and gpay_set_status
-- call is_admin(); gpay_transfer, gpay_set_pin, pos_settle_gpay,
-- withdraw_reel_earnings, place_dropship_order[_gpay], set_monetization and the
-- phone-OTP pair all raise on a null auth.uid().
--
-- NOTE: `20260717000000_grant_api_roles.sql` re-grants EXECUTE on ALL functions
-- to anon and is documented as safe to re-run. If it is ever re-run, it will
-- undo this. Re-apply this migration after it, or add an exception there.

revoke execute on function public.gpay_stripe_topup(uuid, numeric, text)
  from anon, authenticated;

do $$
begin
  execute (
    select string_agg(
      format('revoke execute on function public.%I(%s) from anon, authenticated;',
             p.proname, pg_get_function_identity_arguments(p.oid)),
      ' ')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'issue_invoice'
  );
exception when others then
  raise notice 'issue_invoice not present or already locked: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- Second pass, same audit: `enqueue_webhook(webhook_event, uuid, jsonb)` inserts
-- straight into webhook_deliveries for whichever owner is passed, with no auth
-- check of any kind, and anon held EXECUTE. That let anyone make gwave deliver
-- attacker-authored JSON to any user's registered webhook URL — forged events
-- from a trusted sender. No application code calls it; the webhook_on_* triggers
-- do, and triggers run as the definer rather than as the caller, so revoking the
-- API roles doesn't touch them.
revoke execute on function public.enqueue_webhook(public.webhook_event, uuid, jsonb)
  from anon, authenticated;

-- Left alone deliberately: record_game_play(uuid) has no auth check either, but
-- it only bumps a play counter and IS called from src/lib/actions/games.ts with
-- the user's own client — revoking would break game plays to stop counter
-- inflation, which is a bad trade.

notify pgrst, 'reload schema';
