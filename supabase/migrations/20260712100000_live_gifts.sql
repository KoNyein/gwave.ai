-- TikTok-style Live Gifts, paid with G-Pay. A viewer sends a gift; its G-Pay
-- value moves from the viewer to the host, a gift event is logged (for the
-- animation + top-supporter board), all atomically in one SECURITY DEFINER
-- function. pgcrypto (crypt) lives in `extensions` for the PIN check.

create table public.live_gifts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  emoji text not null,
  price_mmk numeric(12, 2) not null check (price_mmk >= 1),
  sort int not null default 0,
  is_active boolean not null default true
);
alter table public.live_gifts enable row level security;
create policy "Anyone reads active gifts" on public.live_gifts
  for select to authenticated using (is_active or public.is_admin());

insert into public.live_gifts (code, name, emoji, price_mmk, sort) values
  ('rose',    'Rose',    '🌹', 100,   1),
  ('heart',   'Heart',   '❤️', 500,   2),
  ('cheers',  'Cheers',  '🍺', 1000,  3),
  ('party',   'Party',   '🎉', 2000,  4),
  ('lion',    'Lion',    '🦁', 5000,  5),
  ('rocket',  'Rocket',  '🚀', 10000, 6),
  ('crown',   'Crown',   '👑', 20000, 7),
  ('diamond', 'Diamond', '💎', 50000, 8);

-- Gift events (one row per send, quantity folded in).
create table public.live_gift_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  gift_id uuid not null references public.live_gifts (id),
  quantity int not null check (quantity between 1 and 999),
  amount_mmk numeric(14, 2) not null check (amount_mmk >= 0),
  created_at timestamptz not null default now()
);
create index live_gift_events_stream_idx
  on public.live_gift_events (stream_id, created_at desc);
create index live_gift_events_sender_idx
  on public.live_gift_events (stream_id, sender_id);

alter table public.live_gift_events enable row level security;
-- Anyone watching can read the gift feed / leaderboard.
create policy "Read gift events" on public.live_gift_events
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Send a gift: G-Pay viewer -> host, log the event. ACID; PIN-gated like a
-- transfer.
-- ---------------------------------------------------------------------------
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

-- Top supporters of a stream (by total G-Pay gifted).
create or replace function public.live_top_gifters(p_stream uuid, p_limit int default 10)
returns table (
  sender_id uuid,
  username text,
  full_name text,
  avatar_url text,
  total_mmk numeric,
  gift_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select e.sender_id, p.username, p.full_name, p.avatar_url,
         sum(e.amount_mmk) as total_mmk, count(*) as gift_count
  from public.live_gift_events e
  join public.profiles p on p.id = e.sender_id
  where e.stream_id = p_stream
  group by e.sender_id, p.username, p.full_name, p.avatar_url
  order by total_mmk desc
  limit greatest(1, least(p_limit, 50));
$$;

grant execute on function public.live_top_gifters(uuid, int) to anon, authenticated;
