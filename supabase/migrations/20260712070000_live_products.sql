-- Live Sale — a host can pin their shop products to a live stream so viewers
-- buy them (with G-Pay) while watching. Just a join table between live_streams
-- and shop_products; the buying itself reuses the existing dropship + G-Pay
-- order path.

create table public.live_products (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (stream_id, product_id)
);

create index live_products_stream_idx
  on public.live_products (stream_id, created_at);

alter table public.live_products enable row level security;

-- Anyone signed in can see what's pinned to a stream (to buy while watching).
create policy "Read live products"
  on public.live_products
  for select
  to authenticated
  using (true);

-- Only the stream's host may pin, and only their own products.
create policy "Host pins own product to own stream"
  on public.live_products
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.live_streams s
      where s.id = live_products.stream_id and s.host_id = auth.uid()
    )
    and exists (
      select 1 from public.shop_products p
      where p.id = live_products.product_id and p.seller_id = auth.uid()
    )
  );

-- The host may unpin from their own stream.
create policy "Host unpins from own stream"
  on public.live_products
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.live_streams s
      where s.id = live_products.stream_id and s.host_id = auth.uid()
    )
  );
