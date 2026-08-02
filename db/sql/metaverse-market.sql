-- Gwave Metaverse — Marketplace (Phase 19)
--
-- ⚠️⚠️ ဥပဒေခွင့်ပြုချက် မရသေးခင် PRODUCTION မှာ မဖွင့်ပါနဲ့ (spec 19.0)။
--     ဒီ file က table/function တွေကိုသာ ဆောက်တယ် — feature ကို ဖွင့်တာက
--     app ရဲ့ `MV_MARKET_ENABLED` env (default ပိတ်) ဖြစ်ပြီး အဲဒါမဖွင့်ရင်
--     API route တွေက 403 ပြန်တယ်။
--
-- RDS မှာ run ရန် (EC2 app box ပေါ်ကနေ):
--
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   curl -sSL https://raw.githubusercontent.com/KoNyein/gwave.ai/claude/phase-1-implementation-7ysxtj/db/sql/metaverse-market.sql \
--     | sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--         psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
--              -U gwaveadmin -d gwave -v ON_ERROR_STOP=1
--   sudo docker restart postgrest
--
-- ★ `metaverse.sql`, `metaverse-part2.sql`, `gpay-setup.sql` အရင် ရှိရမယ်။
-- ★ ရောင်းဝယ်မှုတိုင်းက **transaction တစ်ခုတည်း** (plpgsql function) —
--   ငွေဖြတ်ပြီး ပစ္စည်းလွှဲရာမှာ ကျရင် အားလုံး ROLLBACK (spec 19.3)။

begin;

-- ── Buy idempotency ─────────────────────────────────────────────────────────
-- ★ "ဝယ်မယ်" ကို ၂ ခါနှိပ်ရင် တစ်ခါပဲ ဖြစ်ရမယ် — key တူတူ ပြန်လာရင်
--   အရင်ရလဒ်ကိုပဲ ပြန်ပေးတယ်။
create table if not exists public.mv_market_tx (
  idempotency_key text primary key,
  listing_id      bigint not null,
  buyer_id        uuid not null,
  created_at      timestamptz not null default now()
);

alter table public.mv_market_tx enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.mv_market_tx to service_role;
  end if;
end $$;

-- ── တင်ရောင်း ───────────────────────────────────────────────────────────────
-- ★ Escrow lock — listing တင်တာနဲ့ ပစ္စည်းက inventory ကနေ ထွက်သွားတယ်။
--   မဟုတ်ရင် တစ်ခုတည်းကို နှစ်နေရာ ရောင်းလို့ရမယ် (spec 19.6)။
create or replace function public.mv_market_list(
  p_kind text,
  p_sku text,
  p_plot_id integer,
  p_price_minor bigint,
  p_idempotency_key text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing_id bigint;
  v_qty integer;
  v_today integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('item', 'plot') then
    raise exception 'Bad kind';
  end if;
  -- ★ စျေးနှုန်း ကန့်သတ် — ฿0.01–฿100,000။ ကိန်းအမှား (฿5 → ฿5,000,000)
  --   နဲ့ money-laundering ပမာဏကြီးကြီး နှစ်ခုစလုံးကို တားတယ် (spec 19.6)။
  if p_price_minor is null or p_price_minor < 1 or p_price_minor > 10000000 then
    raise exception 'Price out of range';
  end if;

  -- ★ တစ်ရက် listing ၂၀ ကန့်သတ် — bot/wash-trading နှေးအောင် (spec 19.6)
  select count(*) into v_today
    from mv_listings
   where seller_id = v_uid and created_at > now() - interval '1 day';
  if v_today >= 20 then
    raise exception 'Daily listing limit reached';
  end if;

  -- Idempotency — key တူရင် ရှိပြီးသား listing ကို ပြန်ပေး
  if p_idempotency_key is not null then
    select id into v_listing_id
      from mv_listings where idempotency_key = p_idempotency_key;
    if found then
      return v_listing_id;
    end if;
  end if;

  if p_kind = 'item' then
    if p_sku is null or length(p_sku) = 0 or length(p_sku) > 64 then
      raise exception 'Bad sku';
    end if;
    -- ★ ပိုင်ဆိုင်မှုစစ် + escrow lock ကို တစ်ချက်တည်း — FOR UPDATE နဲ့
    --   row ကို lock ထားလို့ တစ်ပြိုင်နက် listing ၂ ခု မတင်နိုင်ဘူး။
    select qty into v_qty
      from mv_inventory
     where user_id = v_uid and sku = p_sku
       for update;
    if not found or v_qty < 1 then
      raise exception 'You do not own this item';
    end if;
    update mv_inventory set qty = qty - 1
     where user_id = v_uid and sku = p_sku;

    insert into mv_listings (seller_id, kind, sku, price_minor, idempotency_key)
      values (v_uid, 'item', p_sku, p_price_minor, p_idempotency_key)
      returning id into v_listing_id;
    insert into mv_escrow (listing_id, user_id, sku)
      values (v_listing_id, v_uid, p_sku);

  else -- plot
    perform 1 from mv_plots
      where plot_id = p_plot_id and owner_user = v_uid
      for update;
    if not found then
      raise exception 'You do not own this plot';
    end if;
    -- ★ ကွက်တစ်ကွက်ကို listing တစ်ခုသာ — escrow ရဲ့ plot_id ကို စစ်တယ်
    perform 1 from mv_escrow where plot_id = p_plot_id;
    if found then
      raise exception 'Plot already listed';
    end if;

    insert into mv_listings (seller_id, kind, plot_id, price_minor, idempotency_key)
      values (v_uid, 'plot', p_plot_id, p_price_minor, p_idempotency_key)
      returning id into v_listing_id;
    insert into mv_escrow (listing_id, user_id, plot_id)
      values (v_listing_id, v_uid, p_plot_id);
  end if;

  return v_listing_id;
end;
$$;

-- ── ပယ်ဖျက် ─────────────────────────────────────────────────────────────────
create or replace function public.mv_market_cancel(p_listing_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing mv_listings;
  v_escrow mv_escrow;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_listing from mv_listings
   where id = p_listing_id for update;
  if not found or v_listing.seller_id <> v_uid then
    raise exception 'Not your listing';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'Listing is not active';
  end if;

  select * into v_escrow from mv_escrow where listing_id = p_listing_id;

  -- Escrow ကနေ ရောင်းသူဆီ ပြန်ပေး
  if v_escrow.sku is not null then
    insert into mv_inventory (user_id, sku, qty, source)
      values (v_uid, v_escrow.sku, 1, 'purchase')
      on conflict (user_id, sku) do update set qty = mv_inventory.qty + 1;
  end if;
  -- Plot က escrow မှာ မှတ်ထားရုံပဲ (ownership မပြောင်းသေးလို့ ပြန်ပေးစရာမလို)

  delete from mv_escrow where listing_id = p_listing_id;
  update mv_listings set status = 'cancelled' where id = p_listing_id;
end;
$$;

-- ── ဝယ် ─────────────────────────────────────────────────────────────────────
-- ★ Function တစ်ခုလုံးက transaction တစ်ခု — ဘယ်အဆင့်မှာ ကျကျ အားလုံး
--   ROLLBACK (ငွေဖြတ်ပြီး ပစ္စည်းမလွှဲဘဲ မဖြစ်နိုင်ဘူး)။
-- ★ Lock အစဉ်: listing → gpay account (id ငယ်စဉ်) — deadlock မဖြစ်အောင်
--   အမြဲ ဒီအစဉ်အတိုင်း (spec 19.3)။
create or replace function public.mv_market_buy(
  p_listing_id bigint,
  p_idempotency_key text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing mv_listings;
  v_escrow mv_escrow;
  v_buyer_acct gpay_accounts;
  v_seller_acct gpay_accounts;
  v_amount numeric;
  v_fee numeric;
  v_net numeric;
  v_first uuid;
  v_second uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'Idempotency key required';
  end if;

  -- ★ Idempotency — key တူတူ ၂ ခါလာရင် ဒုတိယအကြိမ်က ဘာမှမလုပ်ဘဲ
  --   အရင် listing id ကို ပြန်ပေးတယ် (spec 19.7: ၂ ခါနှိပ် တစ်ခါဝယ်)။
  perform 1 from mv_market_tx where idempotency_key = p_idempotency_key;
  if found then
    return p_listing_id;
  end if;

  -- ၁။ Listing lock + စစ်
  select * into v_listing from mv_listings
   where id = p_listing_id for update;
  if not found or v_listing.status <> 'active' then
    raise exception 'Listing is not active';
  end if;
  if v_listing.expires_at < now() then
    raise exception 'Listing has expired';
  end if;
  -- ၂။ ★ ကိုယ့်ဟာကိုယ် ဝယ်လို့မရ (wash trading — spec 19.6)
  if v_listing.seller_id = v_uid then
    raise exception 'You cannot buy your own listing';
  end if;

  v_amount := v_listing.price_minor / 100.0;
  -- ★ ကော်မရှင်ကို **ရောင်းသူဆီက** ဖြတ်တယ် (spec 19.4) —
  --   ဝယ်သူက ကြော်ငြာစျေးအတိုင်း ပေးပြီး ရောင်းသူက 95% ရတယ်။
  v_fee := round(v_amount * v_listing.fee_bps / 10000.0, 2);
  v_net := v_amount - v_fee;

  -- ၃။ Account တွေကို id ငယ်စဉ်နဲ့ lock (deadlock ကာကွယ်)
  select a.id into v_first from gpay_accounts a
   where a.user_id in (v_uid, v_listing.seller_id)
   order by a.id limit 1;
  select a.id into v_second from gpay_accounts a
   where a.user_id in (v_uid, v_listing.seller_id)
   order by a.id desc limit 1;
  perform 1 from gpay_accounts where id in (v_first, v_second) for update;

  select * into v_buyer_acct from gpay_accounts
   where user_id = v_uid and status = 'active';
  if not found then
    raise exception 'You need an active G-Pay account';
  end if;
  select * into v_seller_acct from gpay_accounts
   where user_id = v_listing.seller_id and status = 'active';
  if not found then
    raise exception 'Seller has no active G-Pay account';
  end if;
  if v_buyer_acct.balance < v_amount then
    raise exception 'Insufficient balance';
  end if;

  -- ၄။ ငွေလွှဲ — ရောင်းသူ 95% + ကော်မရှင် 5% (fee ledger)
  perform set_config('gpay.allow_ledger', 'on', true);
  update gpay_accounts set balance = balance - v_amount where id = v_buyer_acct.id;
  update gpay_accounts set balance = balance + v_net where id = v_seller_acct.id;
  insert into gpay_transactions (kind, from_account, to_account, amount, note)
    values ('transfer', v_buyer_acct.id, v_seller_acct.id, v_net,
            'Metaverse market: listing #' || p_listing_id);
  insert into gpay_transactions (kind, from_account, to_account, amount, note)
    values ('fee', v_buyer_acct.id, null, v_fee,
            'Metaverse market fee (5%): listing #' || p_listing_id);

  -- ၅။ Escrow ကနေ ဝယ်သူဆီ ပစ္စည်းလွှဲ
  select * into v_escrow from mv_escrow where listing_id = p_listing_id;
  if not found then
    raise exception 'Escrow missing — listing corrupt';
  end if;
  if v_escrow.sku is not null then
    insert into mv_inventory (user_id, sku, qty, source)
      values (v_uid, v_escrow.sku, 1, 'purchase')
      on conflict (user_id, sku) do update set qty = mv_inventory.qty + 1;
  elsif v_escrow.plot_id is not null then
    update mv_plots
       set owner_user = v_uid,
           -- ပိုင်ရှင်အသစ်ရဲ့ wallet က မတူတော့လို့ ရှင်းထားတယ် —
           -- SIWE ပြန်ချိတ်ရင် ပြန်ဖြည့်မယ်
           owner_wallet = null,
           synced_at = now()
     where plot_id = v_escrow.plot_id;
  end if;
  delete from mv_escrow where listing_id = p_listing_id;

  -- ၆။ Listing ပြီးဆုံး + idempotency မှတ်တမ်း
  update mv_listings
     set status = 'sold', sold_to = v_uid, sold_at = now()
   where id = p_listing_id;
  insert into mv_market_tx (idempotency_key, listing_id, buyer_id)
    values (p_idempotency_key, p_listing_id, v_uid);

  return p_listing_id;
end;
$$;

-- ── သက်တမ်းကုန် listing များ ရှင်း ────────────────────────────────────────────
-- ★ Escrow ကို အလိုအလျောက် ပြန်လွှတ်တယ် (spec 19.7)။ Cron/admin ကနေ ခေါ်တယ်။
create or replace function public.mv_market_expire()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_count integer := 0;
begin
  -- Service role (auth.uid() null) ဒါမှမဟုတ် admin သာ
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Admins only';
  end if;

  for v_listing in
    select l.id, l.seller_id, e.sku, e.plot_id
      from mv_listings l
      join mv_escrow e on e.listing_id = l.id
     where l.status = 'active' and l.expires_at < now()
     for update of l
  loop
    if v_listing.sku is not null then
      insert into mv_inventory (user_id, sku, qty, source)
        values (v_listing.seller_id, v_listing.sku, 1, 'purchase')
        on conflict (user_id, sku) do update set qty = mv_inventory.qty + 1;
    end if;
    delete from mv_escrow where listing_id = v_listing.id;
    update mv_listings set status = 'expired' where id = v_listing.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.mv_market_list(text, text, integer, bigint, text) to authenticated;
grant execute on function public.mv_market_cancel(bigint) to authenticated;
grant execute on function public.mv_market_buy(bigint, text) to authenticated;
grant execute on function public.mv_market_expire() to authenticated;

commit;
