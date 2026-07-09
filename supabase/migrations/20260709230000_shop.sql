-- Shop: a member marketplace with two kinds of listing.
--   * affiliate — a product hosted on another website. The card links out to
--     the merchant's page (external_url); the platform records a click. No
--     order or fulfilment happens here.
--   * dropship — a product a member sells but a supplier ships. Buyers place
--     an order with shipping details; the seller forwards it to the supplier
--     and moves it through a status workflow. Orders are created only through
--     the place_dropship_order() function so the price and seller can't be
--     tampered with from the client.
-- Sellers manage their own listings and orders; moderators see everything.

create type public.shop_product_kind as enum ('affiliate', 'dropship');
create type public.shop_product_status as enum ('active', 'hidden');
create type public.shop_order_status as enum (
  'pending', 'forwarded', 'shipped', 'delivered', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  kind public.shop_product_kind not null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  image_url text check (image_url is null or char_length(image_url) <= 1000),
  price numeric(12, 2) check (price is null or price >= 0),
  currency text not null default 'THB' check (char_length(currency) between 2 and 8),
  -- affiliate: outbound merchant link (required); dropship: optional supplier page.
  external_url text check (external_url is null or char_length(external_url) <= 1000),
  -- Display name of the merchant/supplier, e.g. "AliExpress".
  merchant text check (merchant is null or char_length(merchant) <= 80),
  -- The page the listing was imported from, kept for reference.
  source_url text check (source_url is null or char_length(source_url) <= 1000),
  category text check (category is null or char_length(category) <= 40),
  commission_rate numeric(5, 2)
    check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100)),
  clicks_count integer not null default 0 check (clicks_count >= 0),
  status public.shop_product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Affiliate listings must link somewhere; dropship listings need a price.
  constraint shop_affiliate_needs_link
    check (kind <> 'affiliate' or external_url is not null),
  constraint shop_dropship_needs_price
    check (kind <> 'dropship' or price is not null)
);

create index shop_products_browse_idx
  on public.shop_products (status, kind, created_at desc);
create index shop_products_seller_idx
  on public.shop_products (seller_id, created_at desc);

create trigger shop_products_set_updated_at
  before update on public.shop_products
  for each row execute function public.handle_updated_at();

alter table public.shop_products enable row level security;

-- Active listings are public to signed-in users; sellers always see their own,
-- moderators see everything.
create policy "Active products are viewable; sellers and mods see all"
  on public.shop_products
  for select
  to authenticated
  using (
    status = 'active'
    or seller_id = auth.uid()
    or public.is_moderator()
  );

create policy "Members list their own products"
  on public.shop_products
  for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    and not public.is_suspended(auth.uid())
  );

create policy "Sellers and mods update products"
  on public.shop_products
  for update
  to authenticated
  using (seller_id = auth.uid() or public.is_moderator())
  with check (seller_id = auth.uid() or public.is_moderator());

create policy "Sellers and mods delete products"
  on public.shop_products
  for delete
  to authenticated
  using (seller_id = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- Dropship orders
-- ---------------------------------------------------------------------------

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  -- Keep the order history when a listing is deleted: the product reference
  -- goes null (the UI shows a "deleted product" placeholder) rather than
  -- cascading away the buyer's and seller's records.
  product_id uuid references public.shop_products (id) on delete set null,
  -- Denormalized so a seller can query their orders without a join and RLS
  -- stays a simple column check.
  seller_id uuid not null references public.profiles (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 999),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  currency text not null check (char_length(currency) between 2 and 8),
  status public.shop_order_status not null default 'pending',
  ship_name text not null check (char_length(ship_name) between 1 and 120),
  ship_phone text not null check (char_length(ship_phone) between 1 and 40),
  ship_address text not null check (char_length(ship_address) between 1 and 500),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_orders_buyer_idx on public.shop_orders (buyer_id, created_at desc);
create index shop_orders_seller_idx on public.shop_orders (seller_id, created_at desc);

create trigger shop_orders_set_updated_at
  before update on public.shop_orders
  for each row execute function public.handle_updated_at();

alter table public.shop_orders enable row level security;

-- Buyers see their own orders; sellers see orders for their products;
-- moderators see all. There is deliberately NO insert policy — orders are
-- created only via place_dropship_order() so price and seller are trusted.
create policy "Buyers, sellers and mods read orders"
  on public.shop_orders
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or public.is_moderator()
  );

-- Sellers and moderators advance an order's status.
create policy "Sellers and mods update orders"
  on public.shop_orders
  for update
  to authenticated
  using (seller_id = auth.uid() or public.is_moderator())
  with check (seller_id = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- Affiliate clicks
-- ---------------------------------------------------------------------------

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index affiliate_clicks_product_idx
  on public.affiliate_clicks (product_id, created_at desc);

alter table public.affiliate_clicks enable row level security;

-- No insert policy — clicks are recorded via record_affiliate_click().
-- A seller can read the clicks on their own products; moderators read all.
create policy "Sellers and mods read affiliate clicks"
  on public.affiliate_clicks
  for select
  to authenticated
  using (
    public.is_moderator()
    or exists (
      select 1 from public.shop_products p
      where p.id = affiliate_clicks.product_id
        and p.seller_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Record an outbound affiliate click and bump the denormalized counter.
-- Security definer so a signed-in user can log a click without needing an
-- insert policy that would also let them forge arbitrary rows.
create or replace function public.record_affiliate_click(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.affiliate_clicks (product_id, user_id)
  values (p_product_id, auth.uid());
  update public.shop_products
    set clicks_count = clicks_count + 1
    where id = p_product_id;
end;
$$;

-- Place a dropship order. The price and seller are read from the product row
-- here (never trusted from the client), and the buyer is the caller.
create or replace function public.place_dropship_order(
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

  select * into v_product
    from public.shop_products
    where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;
  if v_product.kind <> 'dropship' or v_product.status <> 'active' then
    raise exception 'Product is not available for ordering';
  end if;

  insert into public.shop_orders (
    buyer_id, product_id, seller_id, quantity, unit_price, currency,
    ship_name, ship_phone, ship_address, note
  ) values (
    auth.uid(), v_product.id, v_product.seller_id, p_quantity,
    v_product.price, v_product.currency,
    p_ship_name, p_ship_phone, p_ship_address, p_note
  ) returning id into v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.record_affiliate_click(uuid) to authenticated;
grant execute on function public.place_dropship_order(
  uuid, integer, text, text, text, text
) to authenticated;
