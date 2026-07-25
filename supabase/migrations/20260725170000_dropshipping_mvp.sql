-- Gwave dropshipping MVP
-- Supplier onboarding, catalog import, fulfillment, shipment tracking, and payouts.

create extension if not exists pgcrypto;

create type public.supplier_status as enum ('pending', 'approved', 'suspended', 'rejected');
create type public.dropship_listing_status as enum ('draft', 'active', 'paused', 'archived');
create type public.fulfillment_status as enum ('pending', 'accepted', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.payout_status as enum ('pending', 'approved', 'paid', 'failed', 'cancelled');

create table public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  contact_name text,
  phone text,
  country_code text not null default 'TH',
  address jsonb not null default '{}'::jsonb,
  status public.supplier_status not null default 'pending',
  commission_rate numeric(5,2) not null default 10 check (commission_rate between 0 and 100),
  payout_details jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger supplier_profiles_set_updated_at
  before update on public.supplier_profiles
  for each row execute function public.handle_updated_at();

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  sku text not null,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  images jsonb not null default '[]'::jsonb,
  category_id uuid,
  cost_price numeric(12,2) not null check (cost_price >= 0),
  compare_at_price numeric(12,2),
  currency text not null default 'THB',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  attributes jsonb not null default '{}'::jsonb,
  shipping_profile jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, sku),
  check (reserved_quantity <= stock_quantity)
);

create trigger supplier_products_set_updated_at
  before update on public.supplier_products
  for each row execute function public.handle_updated_at();

create table public.dropship_listings (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id) on delete cascade,
  title text not null,
  description text,
  images jsonb not null default '[]'::jsonb,
  selling_price numeric(12,2) not null check (selling_price >= 0),
  currency text not null default 'THB',
  status public.dropship_listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reseller_id, supplier_product_id)
);

create trigger dropship_listings_set_updated_at
  before update on public.dropship_listings
  for each row execute function public.handle_updated_at();

create table public.fulfillment_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  supplier_id uuid not null references public.supplier_profiles(id),
  reseller_id uuid not null references public.profiles(id),
  customer_shipping_address jsonb not null,
  status public.fulfillment_status not null default 'pending',
  supplier_subtotal numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  reseller_profit numeric(12,2) not null default 0,
  currency text not null default 'THB',
  accepted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, supplier_id)
);

create trigger fulfillment_orders_set_updated_at
  before update on public.fulfillment_orders
  for each row execute function public.handle_updated_at();

create table public.fulfillment_order_items (
  id uuid primary key default gen_random_uuid(),
  fulfillment_order_id uuid not null references public.fulfillment_orders(id) on delete cascade,
  supplier_product_id uuid not null references public.supplier_products(id),
  dropship_listing_id uuid references public.dropship_listings(id),
  sku text not null,
  title text not null,
  quantity integer not null check (quantity > 0),
  supplier_unit_price numeric(12,2) not null check (supplier_unit_price >= 0),
  customer_unit_price numeric(12,2) not null check (customer_unit_price >= 0),
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  fulfillment_order_id uuid not null unique references public.fulfillment_orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.handle_updated_at();

create table public.supplier_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  fulfillment_order_id uuid references public.fulfillment_orders(id),
  entry_type text not null check (entry_type in ('pending_credit', 'available_credit', 'debit', 'refund', 'payout')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'THB',
  description text,
  created_at timestamptz not null default now()
);

create table public.supplier_payouts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'THB',
  status public.payout_status not null default 'pending',
  payout_method jsonb not null default '{}'::jsonb,
  provider_reference text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger supplier_payouts_set_updated_at
  before update on public.supplier_payouts
  for each row execute function public.handle_updated_at();

create index supplier_products_supplier_idx on public.supplier_products(supplier_id);
create index supplier_products_active_idx on public.supplier_products(is_active) where is_active = true;
create index dropship_listings_reseller_idx on public.dropship_listings(reseller_id);
create index fulfillment_orders_supplier_status_idx on public.fulfillment_orders(supplier_id, status);
create index fulfillment_orders_reseller_idx on public.fulfillment_orders(reseller_id);
create index supplier_ledger_supplier_idx on public.supplier_ledger_entries(supplier_id, created_at desc);

alter table public.supplier_profiles enable row level security;
alter table public.supplier_products enable row level security;
alter table public.dropship_listings enable row level security;
alter table public.fulfillment_orders enable row level security;
alter table public.fulfillment_order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.supplier_ledger_entries enable row level security;
alter table public.supplier_payouts enable row level security;

create policy "supplier reads own profile" on public.supplier_profiles
for select using (user_id = auth.uid());
create policy "supplier creates own profile" on public.supplier_profiles
for insert with check (user_id = auth.uid());
create policy "supplier updates own profile" on public.supplier_profiles
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "approved catalog is publicly readable" on public.supplier_products
for select using (
  is_active = true and exists (
    select 1 from public.supplier_profiles sp
    where sp.id = supplier_id and sp.status = 'approved'
  )
);
create policy "supplier manages own products" on public.supplier_products
for all using (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid())
) with check (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid() and sp.status = 'approved')
);

create policy "reseller manages own listings" on public.dropship_listings
for all using (reseller_id = auth.uid()) with check (reseller_id = auth.uid());
create policy "active listings are publicly readable" on public.dropship_listings
for select using (status = 'active');

create policy "supplier reads own fulfillment" on public.fulfillment_orders
for select using (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid())
);
create policy "reseller reads own fulfillment" on public.fulfillment_orders
for select using (reseller_id = auth.uid());
create policy "supplier updates own fulfillment" on public.fulfillment_orders
for update using (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid())
);

create policy "participants read fulfillment items" on public.fulfillment_order_items
for select using (
  exists (
    select 1 from public.fulfillment_orders fo
    left join public.supplier_profiles sp on sp.id = fo.supplier_id
    where fo.id = fulfillment_order_id
      and (fo.reseller_id = auth.uid() or sp.user_id = auth.uid())
  )
);

create policy "participants read shipments" on public.shipments
for select using (
  exists (
    select 1 from public.fulfillment_orders fo
    left join public.supplier_profiles sp on sp.id = fo.supplier_id
    where fo.id = fulfillment_order_id
      and (fo.reseller_id = auth.uid() or sp.user_id = auth.uid())
  )
);
create policy "supplier manages shipment" on public.shipments
for all using (
  exists (
    select 1 from public.fulfillment_orders fo
    join public.supplier_profiles sp on sp.id = fo.supplier_id
    where fo.id = fulfillment_order_id and sp.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.fulfillment_orders fo
    join public.supplier_profiles sp on sp.id = fo.supplier_id
    where fo.id = fulfillment_order_id and sp.user_id = auth.uid()
  )
);

create policy "supplier reads own ledger" on public.supplier_ledger_entries
for select using (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid())
);
create policy "supplier reads own payouts" on public.supplier_payouts
for select using (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid())
);
create policy "supplier requests own payout" on public.supplier_payouts
for insert with check (
  exists (select 1 from public.supplier_profiles sp where sp.id = supplier_id and sp.user_id = auth.uid() and sp.status = 'approved')
);

comment on table public.supplier_profiles is 'Dropshipping suppliers and their approval/payout configuration.';
comment on table public.dropship_listings is 'Reseller-specific copies of supplier catalog items with independent pricing.';
comment on table public.fulfillment_orders is 'One fulfillment record per supplier for a customer order.';
