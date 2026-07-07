-- Phase 7: Loyverse-style POS — stores, products, inventory, sales, shifts.
-- Access is store-scoped: staff can sell, managers manage everything.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.store_role as enum ('staff', 'manager');

create type public.payment_method as enum ('cash', 'card', 'qr');

create type public.sale_status as enum ('completed', 'refunded');

create type public.stock_reason as enum (
  'sale',
  'refund',
  'adjustment',
  'purchase'
);

-- ---------------------------------------------------------------------------
-- Stores & membership
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  currency text not null default 'USD',
  receipt_footer text,
  next_receipt_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.handle_updated_at();

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.store_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index store_members_user_idx on public.store_members (user_id);

-- Membership helpers (SECURITY DEFINER to avoid policy recursion).
-- The store owner is always an implicit manager.
create or replace function public.is_store_member(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores s
    where s.id = sid and s.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.store_members m
    where m.store_id = sid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_store_manager(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores s
    where s.id = sid and s.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.store_members m
    where m.store_id = sid and m.user_id = auth.uid() and m.role = 'manager'
  );
$$;

-- ---------------------------------------------------------------------------
-- Catalog & inventory
-- ---------------------------------------------------------------------------

create table public.pos_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index pos_categories_store_idx on public.pos_categories (store_id);

create table public.pos_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.pos_categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  sku text,
  barcode text,
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  image_path text,
  track_stock boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pos_products_store_idx on public.pos_products (store_id, active);
create index pos_products_barcode_idx
  on public.pos_products (store_id, barcode)
  where barcode is not null;

create trigger pos_products_set_updated_at
  before update on public.pos_products
  for each row execute function public.handle_updated_at();

create table public.inventory (
  product_id uuid primary key
    references public.pos_products (id) on delete cascade,
  quantity numeric(12, 2) not null default 0,
  low_stock_threshold numeric(12, 2) not null default 5,
  updated_at timestamptz not null default now()
);

create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.handle_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.pos_products (id) on delete cascade,
  delta numeric(12, 2) not null,
  reason public.stock_reason not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_product_idx
  on public.stock_movements (product_id, created_at desc);

-- Every stock movement adjusts the inventory row (created on demand).
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory (product_id, quantity)
  values (new.product_id, new.delta)
  on conflict (product_id)
  do update set quantity = public.inventory.quantity + new.delta;
  return null;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- Customers, shifts, sales
-- ---------------------------------------------------------------------------

create table public.pos_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text,
  email text,
  note text,
  created_at timestamptz not null default now()
);

create index pos_customers_store_idx on public.pos_customers (store_id);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  opened_at timestamptz not null default now(),
  float_amount numeric(12, 2) not null default 0 check (float_amount >= 0),
  cash_in numeric(12, 2) not null default 0,
  cash_out numeric(12, 2) not null default 0,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  expected_cash numeric(12, 2),
  actual_cash numeric(12, 2),
  note text
);

-- One open shift per store at a time.
create unique index shifts_one_open_per_store
  on public.shifts (store_id)
  where closed_at is null;
create index shifts_store_idx on public.shifts (store_id, opened_at desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  shift_id uuid references public.shifts (id) on delete set null,
  cashier_id uuid references public.profiles (id) on delete set null,
  customer_id uuid references public.pos_customers (id) on delete set null,
  receipt_number integer not null,
  subtotal numeric(12, 2) not null,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  status public.sale_status not null default 'completed',
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, receipt_number)
);

create index sales_store_idx on public.sales (store_id, created_at desc);
create index sales_shift_idx on public.sales (shift_id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.pos_products (id) on delete set null,
  name text not null,
  price numeric(12, 2) not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null
);

create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12, 2) not null check (amount > 0)
);

create index sale_payments_sale_idx on public.sale_payments (sale_id);

-- ---------------------------------------------------------------------------
-- RPCs: atomic checkout and refund
-- ---------------------------------------------------------------------------

-- Creates a sale with items, payments and stock movements in one
-- transaction. Prices come from the catalog (never from the client);
-- line/cart discounts are validated against the computed amounts.
create or replace function public.create_sale(
  p_store_id uuid,
  p_items jsonb,           -- [{product_id, quantity, discount}]
  p_payments jsonb,        -- [{method, amount}]
  p_cart_discount numeric default 0,
  p_customer_id uuid default null
)
returns table (sale_id uuid, receipt_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_shift uuid;
  v_receipt integer;
  v_sale uuid;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item record;
  v_product public.pos_products%rowtype;
  v_line_total numeric;
  v_paid numeric := 0;
begin
  if v_user is null or not public.is_store_member(p_store_id) then
    raise exception 'Not a member of this store';
  end if;

  select id into v_shift
  from public.shifts
  where store_id = p_store_id and closed_at is null;
  if v_shift is null then
    raise exception 'No open shift';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Sale has no items';
  end if;
  if p_cart_discount < 0 then
    raise exception 'Invalid cart discount';
  end if;

  -- Claim the receipt number (row lock serializes concurrent sales).
  update public.stores
  set next_receipt_number = next_receipt_number + 1
  where id = p_store_id
  returning next_receipt_number - 1 into v_receipt;

  insert into public.sales
    (store_id, shift_id, cashier_id, customer_id, receipt_number,
     subtotal, discount, total)
  values (p_store_id, v_shift, v_user, p_customer_id, v_receipt, 0, 0, 0)
  returning id into v_sale;

  for v_item in
    select
      (entry ->> 'product_id')::uuid as product_id,
      (entry ->> 'quantity')::numeric as quantity,
      coalesce((entry ->> 'discount')::numeric, 0) as discount
    from jsonb_array_elements(p_items) as entry
  loop
    select * into v_product
    from public.pos_products
    where id = v_item.product_id and store_id = p_store_id and active;
    if v_product.id is null then
      raise exception 'Unknown product %', v_item.product_id;
    end if;
    if v_item.quantity <= 0 or v_item.discount < 0 then
      raise exception 'Invalid quantity or discount';
    end if;

    v_line_total := round(
      v_product.price * v_item.quantity - v_item.discount, 2
    );
    if v_line_total < 0 then
      raise exception 'Line discount exceeds line total';
    end if;
    v_subtotal := v_subtotal + v_line_total;

    insert into public.sale_items
      (sale_id, product_id, name, price, quantity, discount, total)
    values
      (v_sale, v_product.id, v_product.name, v_product.price,
       v_item.quantity, v_item.discount, v_line_total);

    if v_product.track_stock then
      insert into public.stock_movements
        (product_id, delta, reason, created_by)
      values (v_product.id, -v_item.quantity, 'sale', v_user);
    end if;
  end loop;

  v_total := round(v_subtotal - p_cart_discount, 2);
  if v_total < 0 then
    raise exception 'Cart discount exceeds subtotal';
  end if;

  select coalesce(sum((entry ->> 'amount')::numeric), 0) into v_paid
  from jsonb_array_elements(p_payments) as entry;
  if round(v_paid, 2) < v_total then
    raise exception 'Payments (%) do not cover the total (%)', v_paid, v_total;
  end if;

  insert into public.sale_payments (sale_id, method, amount)
  select
    v_sale,
    (entry ->> 'method')::public.payment_method,
    (entry ->> 'amount')::numeric
  from jsonb_array_elements(p_payments) as entry
  where (entry ->> 'amount')::numeric > 0;

  update public.sales
  set subtotal = v_subtotal, discount = p_cart_discount, total = v_total
  where id = v_sale;

  return query select v_sale, v_receipt;
end;
$$;

-- Refund a completed sale: marks it refunded and returns tracked stock.
-- Managers only.
create or replace function public.refund_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_item record;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;
  if not public.is_store_manager(v_sale.store_id) then
    raise exception 'Manager access required';
  end if;
  if v_sale.status = 'refunded' then
    raise exception 'Sale already refunded';
  end if;

  update public.sales
  set status = 'refunded', refunded_at = now()
  where id = p_sale_id;

  for v_item in
    select si.product_id, si.quantity
    from public.sale_items si
    join public.pos_products p on p.id = si.product_id
    where si.sale_id = p_sale_id and p.track_stock
  loop
    insert into public.stock_movements (product_id, delta, reason, note, created_by)
    values (v_item.product_id, v_item.quantity, 'refund',
            'Refund of sale ' || p_sale_id, v_user);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — store-scoped; writes that must be atomic go through
-- the SECURITY DEFINER RPCs above.
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.pos_categories enable row level security;
alter table public.pos_products enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.pos_customers enable row level security;
alter table public.shifts enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;

create policy "Members see their stores"
  on public.stores for select to authenticated
  using (public.is_store_member(id));

create policy "Users can create stores they own"
  on public.stores for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Managers can update the store"
  on public.stores for update to authenticated
  using (public.is_store_manager(id))
  with check (public.is_store_manager(id));

create policy "Owners can delete their store"
  on public.stores for delete to authenticated
  using (owner_id = auth.uid());

create policy "Members see the member list"
  on public.store_members for select to authenticated
  using (public.is_store_member(store_id));

create policy "Managers manage members"
  on public.store_members for insert to authenticated
  with check (public.is_store_manager(store_id));

create policy "Managers update members"
  on public.store_members for update to authenticated
  using (public.is_store_manager(store_id))
  with check (public.is_store_manager(store_id));

create policy "Managers remove members"
  on public.store_members for delete to authenticated
  using (public.is_store_manager(store_id));

create policy "Members read categories"
  on public.pos_categories for select to authenticated
  using (public.is_store_member(store_id));

create policy "Managers manage categories"
  on public.pos_categories for all to authenticated
  using (public.is_store_manager(store_id))
  with check (public.is_store_manager(store_id));

create policy "Members read products"
  on public.pos_products for select to authenticated
  using (public.is_store_member(store_id));

create policy "Managers manage products"
  on public.pos_products for all to authenticated
  using (public.is_store_manager(store_id))
  with check (public.is_store_manager(store_id));

create policy "Members read inventory"
  on public.inventory for select to authenticated
  using (
    exists (
      select 1 from public.pos_products p
      where p.id = product_id and public.is_store_member(p.store_id)
    )
  );

create policy "Managers set stock thresholds"
  on public.inventory for update to authenticated
  using (
    exists (
      select 1 from public.pos_products p
      where p.id = product_id and public.is_store_manager(p.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.pos_products p
      where p.id = product_id and public.is_store_manager(p.store_id)
    )
  );

create policy "Members read stock movements"
  on public.stock_movements for select to authenticated
  using (
    exists (
      select 1 from public.pos_products p
      where p.id = product_id and public.is_store_member(p.store_id)
    )
  );

create policy "Managers adjust stock"
  on public.stock_movements for insert to authenticated
  with check (
    reason in ('adjustment', 'purchase')
    and created_by = auth.uid()
    and exists (
      select 1 from public.pos_products p
      where p.id = product_id and public.is_store_manager(p.store_id)
    )
  );

create policy "Members manage customers"
  on public.pos_customers for all to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy "Members read shifts"
  on public.shifts for select to authenticated
  using (public.is_store_member(store_id));

create policy "Members open shifts"
  on public.shifts for insert to authenticated
  with check (
    public.is_store_member(store_id) and opened_by = auth.uid()
  );

create policy "Members update the open shift"
  on public.shifts for update to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy "Members read sales"
  on public.sales for select to authenticated
  using (public.is_store_member(store_id));

create policy "Members read sale items"
  on public.sale_items for select to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id and public.is_store_member(s.store_id)
    )
  );

create policy "Members read sale payments"
  on public.sale_payments for select to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id and public.is_store_member(s.store_id)
    )
  );
