-- ═══════════════════════════════════════════════════════════════════════
-- GWAVE item economy — G-Points, item shop, inventory, daily reward,
-- market listings (src/app/(social)/items + /inventory).
--
-- Run on EC2 (the Claude container cannot reach RDS):
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
--          -U gwaveadmin -d gwave -f - < gwave-economy.sql
--   sudo docker restart postgrest        # DDL → schema cache refresh
--
-- House convention: RLS sealed, service_role grants only — the Next.js
-- routes (/api/economy/*) go through the admin client; every mutation is
-- an atomic SQL function so points can never race (buy = deduct + mint in
-- one transaction). Functions RAISE codes the client maps to Burmese.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists gwave_items (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique,
  name           text not null,
  name_my        text,
  category       text not null default 'other',
  rarity         text not null default 'common',
  thumbnail_url  text,
  asset_url      text,
  price_points   integer not null default 0,
  for_sale       boolean not null default true,
  max_supply     integer,                      -- null = unlimited
  minted_count   integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists gwave_user_items (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  item_id       uuid not null references gwave_items(id),
  serial_no     integer,
  equipped      boolean not null default false,
  locked        boolean not null default false, -- listed for sale
  acquired_via  text not null default 'purchase',
  created_at    timestamptz not null default now()
);
create index if not exists gwave_user_items_profile_idx
  on gwave_user_items (profile_id, created_at desc);

create table if not exists gwave_points (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  balance     integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists gwave_points_tx (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  delta       integer not null,
  reason      text not null,
  ref         text,
  created_at  timestamptz not null default now()
);
-- ref ပါတဲ့ tx က idempotent — daily reward (ref = ရက်စွဲ) တစ်နေ့တစ်ခါပဲ
create unique index if not exists gwave_points_tx_dedupe
  on gwave_points_tx (profile_id, reason, ref) where ref is not null;

create table if not exists gwave_listings (
  id            uuid primary key default gen_random_uuid(),
  user_item_id  uuid not null references gwave_user_items(id) on delete cascade,
  seller_id     uuid not null references profiles(id) on delete cascade,
  price_points  integer not null,
  status        text not null default 'open',   -- open | sold | cancelled
  created_at    timestamptz not null default now()
);
create index if not exists gwave_listings_open_idx
  on gwave_listings (status, created_at desc);

-- ── Seal: RLS + service_role only ───────────────────────────────────────
alter table gwave_items       enable row level security;
alter table gwave_user_items  enable row level security;
alter table gwave_points      enable row level security;
alter table gwave_points_tx   enable row level security;
alter table gwave_listings    enable row level security;
revoke all on gwave_items, gwave_user_items, gwave_points,
              gwave_points_tx, gwave_listings from anon, authenticated;
grant select, insert, update, delete
  on gwave_items, gwave_user_items, gwave_points,
     gwave_points_tx, gwave_listings to service_role;

-- ── Atomic functions ───────────────────────────────────────────────────
-- Points ချိန် — balance မလောက်ရင် INSUFFICIENT_POINTS၊ ref ထပ်ရင်
-- ALREADY_CLAIMED (daily reward dedupe)။
create or replace function fn_adjust_points(
  p_profile uuid, p_delta integer, p_reason text, p_ref text default null
) returns integer language plpgsql security definer as $$
declare v_balance integer;
begin
  insert into gwave_points (profile_id, balance)
    values (p_profile, 0)
    on conflict (profile_id) do nothing;
  select balance into v_balance from gwave_points
    where profile_id = p_profile for update;
  if v_balance + p_delta < 0 then
    raise exception 'INSUFFICIENT_POINTS';
  end if;
  begin
    insert into gwave_points_tx (profile_id, delta, reason, ref)
      values (p_profile, p_delta, p_reason, p_ref);
  exception when unique_violation then
    raise exception 'ALREADY_CLAIMED';
  end;
  update gwave_points
    set balance = v_balance + p_delta, updated_at = now()
    where profile_id = p_profile;
  return v_balance + p_delta;
end $$;

-- ဝယ် — item lock ပြီး supply/price စစ်၊ points ဖြတ်၊ mint (serial တိုး)
create or replace function fn_buy_item(p_profile uuid, p_item uuid)
returns uuid language plpgsql security definer as $$
declare v_item gwave_items%rowtype; v_user_item uuid;
begin
  select * into v_item from gwave_items where id = p_item for update;
  if not found or not v_item.for_sale then
    raise exception 'NOT_FOR_SALE';
  end if;
  if v_item.max_supply is not null
     and v_item.minted_count >= v_item.max_supply then
    raise exception 'SOLD_OUT';
  end if;
  perform fn_adjust_points(p_profile, -v_item.price_points, 'buy',
                           null);
  update gwave_items set minted_count = minted_count + 1
    where id = p_item;
  insert into gwave_user_items (profile_id, item_id, serial_no, acquired_via)
    values (p_profile, p_item, v_item.minted_count + 1, 'purchase')
    returning id into v_user_item;
  return v_user_item;
end $$;

-- နေ့စဉ်ဆု +50 G — တစ်နေ့တစ်ခါ (tx dedupe က ALREADY_CLAIMED ပစ်တယ်)
create or replace function fn_claim_daily(p_profile uuid)
returns integer language plpgsql security definer as $$
begin
  return fn_adjust_points(p_profile, 50, 'daily_login', current_date::text);
end $$;

-- တပ်ဆင် — ပိုင်ဆိုင်မှု + lock စစ်၊ category တူ တခြားဟာ ချွတ်
create or replace function fn_equip(p_profile uuid, p_user_item uuid)
returns void language plpgsql security definer as $$
declare v_row gwave_user_items%rowtype; v_cat text;
begin
  select * into v_row from gwave_user_items
    where id = p_user_item and profile_id = p_profile for update;
  if not found or v_row.locked then
    raise exception 'NOT_OWNED_OR_LOCKED';
  end if;
  select category into v_cat from gwave_items where id = v_row.item_id;
  update gwave_user_items ui set equipped = false
    from gwave_items i
    where ui.item_id = i.id and ui.profile_id = p_profile
      and i.category = v_cat and ui.equipped;
  update gwave_user_items set equipped = true where id = p_user_item;
end $$;

-- ရောင်းစာရင်းတင် — ပိုင်ဆိုင် + မတပ်ဆင် + မ lock မှ ရ၊ တင်ရင် lock
create or replace function fn_list_item(
  p_profile uuid, p_user_item uuid, p_price integer
) returns uuid language plpgsql security definer as $$
declare v_row gwave_user_items%rowtype; v_listing uuid;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'CANNOT_LIST';
  end if;
  select * into v_row from gwave_user_items
    where id = p_user_item and profile_id = p_profile for update;
  if not found or v_row.locked or v_row.equipped then
    raise exception 'CANNOT_LIST';
  end if;
  update gwave_user_items set locked = true where id = p_user_item;
  insert into gwave_listings (user_item_id, seller_id, price_points)
    values (p_user_item, p_profile, p_price)
    returning id into v_listing;
  return v_listing;
end $$;

-- ── Seed items (idempotent — sku conflict ကျော်) ───────────────────────
insert into gwave_items
  (sku, name, name_my, category, rarity, price_points, max_supply) values
  ('gold_soldier',  'Gold Soldier',  'ရွှေစစ်သား',        'avatar_skin', 'legendary', 5000, 50),
  ('neon_xbot',     'Neon X Bot',    'နီယွန် X Bot',      'avatar_skin', 'epic',      2500, 200),
  ('mm_flag_badge', 'Myanmar Badge', 'မြန်မာ့တံဆိပ်',      'badge',       'rare',       800, null),
  ('vip_crown',     'VIP Crown',     'VIP သရဖူ',          'badge',       'epic',      3000, 100),
  ('dance_fever',   'Dance Fever',   'အက emote',          'emote',       'uncommon',   400, null),
  ('firework_pack', 'Fireworks',     'မီးပန်း (၅ ခါသုံး)', 'consumable',  'common',     150, null),
  ('drone_camo',    'Drone Camo',    'Drone Camo Skin',   'weapon_skin', 'rare',      1200, 500),
  ('room_neon',     'Neon Room Kit', 'အခန်း Neon အလှ',    'room_decor',  'uncommon',   600, null)
on conflict (sku) do nothing;
