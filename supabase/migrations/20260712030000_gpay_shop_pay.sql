-- G-Pay as a payment method — pay for gwave Shop orders and POS sales with the
-- MMK-pegged G-Pay wallet, on top of the existing account-to-account transfer.
--
-- Online Shop: a dropship order can be paid instantly from the buyer's G-Pay
-- balance; the order total (in its listing currency) is converted to G-Pay via
-- the currency engine and moved buyer -> seller atomically, in the same
-- transaction that records the order. Either the whole thing commits or nothing
-- does (ACID), so an order is never created without its payment.
--
-- POS (ops): 'gpay' becomes a recorded tender method alongside cash/card/qr so
-- a till can accept G-Pay.

-- ---------------------------------------------------------------------------
-- Shop orders: payment columns
-- ---------------------------------------------------------------------------
alter table public.shop_orders
  add column if not exists paid boolean not null default false,
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('gpay', 'cod')),
  add column if not exists gpay_txn_id uuid
    references public.gpay_transactions (id) on delete set null;

-- POS tender enum gains G-Pay. (New enum values can't be used in the same
-- transaction that adds them; create_sale only casts text -> enum at runtime,
-- so no function change is needed.)
alter type public.payment_method add value if not exists 'gpay';

-- ---------------------------------------------------------------------------
-- Pay for a dropship order from the buyer's G-Pay wallet.
-- Mirrors place_dropship_order but also settles payment buyer -> seller in
-- G-Pay (converted from the listing currency), all in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.place_dropship_order_gpay(
  p_product_id uuid,
  p_quantity integer,
  p_ship_name text,
  p_ship_phone text,
  p_ship_address text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.shop_products;
  v_buyer public.gpay_accounts;
  v_seller public.gpay_accounts;
  v_total numeric(14, 2);
  v_gpay numeric(14, 2);
  v_txn uuid;
  v_order_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_suspended(auth.uid()) then
    raise exception 'Account suspended';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Invalid quantity';
  end if;

  select * into v_product from public.shop_products where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_product.kind <> 'dropship' or v_product.status <> 'active' then
    raise exception 'Product is not available for ordering';
  end if;
  if v_product.price is null then
    raise exception 'Product has no price';
  end if;

  -- Convert the order total (listing currency) into G-Pay (= MMK).
  v_total := round(v_product.price * p_quantity, 2);
  v_gpay := round(public.currency_to_gpay(v_total, v_product.currency), 2);
  if v_gpay is null or v_gpay < 0.01 then
    raise exception 'This currency cannot be paid with G-Pay';
  end if;

  -- Buyer must have an active wallet with enough balance.
  select * into v_buyer from public.gpay_accounts where user_id = auth.uid();
  if not found or v_buyer.status <> 'active' then
    raise exception 'Your G-Pay account is not active';
  end if;
  if v_buyer.balance < v_gpay then
    raise exception 'Insufficient G-Pay balance';
  end if;

  -- Seller must accept G-Pay (active wallet).
  select * into v_seller
    from public.gpay_accounts
    where user_id = v_product.seller_id and status = 'active';
  if not found then
    raise exception 'Seller does not accept G-Pay';
  end if;
  if v_seller.id = v_buyer.id then
    raise exception 'You cannot buy your own product';
  end if;

  -- Settle payment buyer -> seller and record it in the ledger.
  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - v_gpay where id = v_buyer.id;
  update public.gpay_accounts set balance = balance + v_gpay where id = v_seller.id;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('transfer', v_buyer.id, v_seller.id, v_gpay,
            'Shop: ' || left(coalesce(v_product.title, 'order'), 120))
    returning id into v_txn;

  -- Create the (already paid) order.
  insert into public.shop_orders (
    buyer_id, product_id, seller_id, quantity, unit_price, currency,
    ship_name, ship_phone, ship_address, note,
    paid, payment_method, gpay_txn_id
  ) values (
    auth.uid(), v_product.id, v_product.seller_id, p_quantity,
    v_product.price, v_product.currency,
    p_ship_name, p_ship_phone, p_ship_address, p_note,
    true, 'gpay', v_txn
  ) returning id into v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.place_dropship_order_gpay(
  uuid, integer, text, text, text, text
) to authenticated;
