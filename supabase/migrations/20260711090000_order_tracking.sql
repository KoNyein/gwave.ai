-- Delivery tracking for shop orders: courier + tracking number the seller
-- can add, and timestamps stamped automatically as the order advances, so
-- the buyer sees a real delivery timeline.

alter table public.shop_orders
  add column if not exists courier text
    check (courier is null or char_length(courier) <= 60),
  add column if not exists tracking_number text
    check (tracking_number is null or char_length(tracking_number) <= 80),
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- Stamp shipped_at / delivered_at the first time an order reaches each state.
create or replace function public.stamp_order_milestones()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'shipped' and old.status is distinct from 'shipped'
     and new.shipped_at is null then
    new.shipped_at := now();
  end if;
  if new.status = 'delivered' and old.status is distinct from 'delivered'
     and new.delivered_at is null then
    new.delivered_at := now();
    if new.shipped_at is null then
      new.shipped_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_orders_stamp_milestones on public.shop_orders;
create trigger shop_orders_stamp_milestones
  before update on public.shop_orders
  for each row execute function public.stamp_order_milestones();
