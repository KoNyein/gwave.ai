-- Gifting an ENDED broadcast moved real G-Pay money.
--
-- send_live_gift() loaded the stream row only to read host_id — it never looked
-- at `status`. So a viewer sitting on a finished /live/<id> page (or replaying
-- the RPC) could keep transferring G-Pay to a host who stopped broadcasting
-- hours ago, and the gift would still land on the top-supporters board.
-- ReactionBar is gated on status='ended'; the gift sheet never was, and the bug
-- was masked until 2026-07-13 because the gift catalog itself was empty
-- (getLiveGifts used the anon client against an authenticated-only policy).
--
-- 'idle' is deliberately still allowed: a stream is created idle and only flips
-- to 'live' when the host's browser starts publishing, so viewers waiting in
-- the lobby would otherwise be blocked. Only the terminal state is refused.

create or replace function public.send_live_gift(
  p_stream uuid,
  p_gift uuid,
  p_quantity int,
  p_pin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_gift public.live_gifts;
  v_stream public.live_streams;
  v_from public.gpay_accounts;
  v_to public.gpay_accounts;
  v_hash text;
  v_amount numeric(14, 2);
  v_event uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Invalid quantity';
  end if;

  select * into v_gift from public.live_gifts where id = p_gift and is_active;
  if not found then raise exception 'Gift not available'; end if;

  select * into v_stream from public.live_streams where id = p_stream;
  if not found then raise exception 'Stream not found'; end if;
  -- The new gate. Same wording the client already shows for an ended stage.
  if v_stream.status = 'ended' then
    raise exception 'This broadcast has ended.';
  end if;

  v_amount := round(v_gift.price_mmk * p_quantity, 2);

  select * into v_from from public.gpay_accounts where user_id = auth.uid();
  if not found or v_from.status <> 'active' then
    raise exception 'Your G-Pay account is not active';
  end if;
  if v_from.balance < v_amount then
    raise exception 'Insufficient G-Pay balance';
  end if;

  -- PIN gate (same as a transfer) if the sender set one.
  select pin_hash into v_hash from public.gpay_pins where user_id = auth.uid();
  if v_hash is not null then
    if p_pin is null then raise exception 'PIN required'; end if;
    if crypt(p_pin, v_hash) <> v_hash then raise exception 'Incorrect PIN'; end if;
  end if;

  select * into v_to
    from public.gpay_accounts where user_id = v_stream.host_id and status = 'active';
  if not found then raise exception 'Host cannot receive gifts yet'; end if;
  if v_to.id = v_from.id then raise exception 'You cannot gift your own stream'; end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - v_amount where id = v_from.id;
  update public.gpay_accounts set balance = balance + v_amount where id = v_to.id;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('transfer', v_from.id, v_to.id, v_amount,
            'Live gift: ' || v_gift.emoji || ' ' || v_gift.name || ' x' || p_quantity);

  insert into public.live_gift_events
    (stream_id, sender_id, host_id, gift_id, quantity, amount_mmk)
    values (p_stream, auth.uid(), v_stream.host_id, p_gift, p_quantity, v_amount)
    returning id into v_event;
  return v_event;
end;
$$;

grant execute on function public.send_live_gift(uuid, uuid, int, text) to authenticated;

-- PostgREST caches the schema; without this the replaced function is not picked
-- up until a restart (see the currency_system/gpay_convert incident).
notify pgrst, 'reload schema';
