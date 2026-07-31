-- Ride hailing (Grab/Bolt style) — schema, state machine and money.
--
-- Design decisions worth knowing before you read the tables:
--
-- 1. NO Redis. Driver positions live in `ride_driver_locations`, one row per
--    driver, UPSERTed in place (never appended) with fillfactor 70 so the
--    every-few-seconds write stays a HOT update and the table does not bloat.
--    `ride_nearest_drivers()` prefilters with a bounding box on the btree index
--    and only then computes haversine. This is good for hundreds — low
--    thousands — of concurrent drivers. When the function's p99 crosses ~50ms,
--    that is the signal to move this ONE table to ElastiCache, and nothing else
--    has to change.
--
-- 2. NO PostGIS / earthdistance dependency. The distance maths is inline so
--    this file runs on a stock RDS Postgres with no extension install.
--
-- 3. The trip state machine is enforced by a TRIGGER, not by the client and not
--    by the API layer. A driver must not be able to jump `accepted` straight to
--    `completed` and collect a fare for a ride that never happened. The trigger
--    also stamps the transition timestamps itself, so they cannot be forged.
--
-- 4. Money is double-entry-ish and never invented. A wallet ride moves rider →
--    driver (net) and rider → platform (commission) inside one transaction. A
--    cash ride moves no wallet money; instead the driver's commission becomes a
--    debt in `ride_driver_balances.commission_owed`, which they settle later.
--    Without that ledger, cash rides silently leak the platform's revenue.
--
-- 5. Every table has RLS enabled with ZERO policies: invisible to PostgREST, so
--    all reads and writes go through /api/ride/*. One gate, one place. For
--    money tables this is not a style preference — a policy bug here is theft.
--
-- Run on RDS, then: sudo docker restart postgrest

-- ===========================================================================
-- Vehicle types and fares
-- ===========================================================================

-- Fares live in a table, not in code, so an admin can reprice without a deploy
-- — which is the whole point of the pricing screen in the admin dashboard.
create table if not exists public.ride_vehicle_types (
  code text primary key check (code in ('bike', 'car', 'three_wheeler', 'delivery')),
  label_en text not null,
  label_my text not null,
  -- Sort order in the picker; bike first in Myanmar.
  sort_order integer not null default 0,
  enabled boolean not null default true,
  -- Fare formula: base + (per_km * km) + (per_min * minutes), floored at
  -- min_fare, then multiplied by any active surge. MMK, 2dp for consistency
  -- with gpay_accounts.balance even though Kyat has no subunit in practice.
  base_fare numeric(12, 2) not null default 0 check (base_fare >= 0),
  per_km numeric(12, 2) not null default 0 check (per_km >= 0),
  per_min numeric(12, 2) not null default 0 check (per_min >= 0),
  min_fare numeric(12, 2) not null default 0 check (min_fare >= 0),
  -- Cancellation fee charged to the rider when they cancel after a driver has
  -- already accepted and started moving. 0 disables it.
  cancel_fee numeric(12, 2) not null default 0 check (cancel_fee >= 0),
  -- Platform cut, 0.00–1.00. Per vehicle type because a bike ride cannot carry
  -- the same percentage as a car ride and still be worth driving.
  commission_rate numeric(4, 3) not null default 0.150
    check (commission_rate >= 0 and commission_rate <= 1),
  -- Max passengers / max package weight, shown in the picker.
  capacity integer not null default 1 check (capacity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ride_vehicle_types
  (code, label_en, label_my, sort_order, base_fare, per_km, per_min, min_fare,
   cancel_fee, commission_rate, capacity)
values
  ('bike',          'Bike',        'မော်တော်ဆိုင်ကယ်', 1,  500,  200,  20, 1000,  500, 0.150, 1),
  ('three_wheeler', 'Three-wheel', 'သုံးဘီး',          2,  700,  250,  25, 1500,  700, 0.150, 3),
  ('car',           'Car',         'ကား',              3, 1500,  450,  50, 3000, 1500, 0.180, 4),
  ('delivery',      'Delivery',    'ပစ္စည်းပို့',        4,  800,  250,  20, 1500,  800, 0.150, 1)
on conflict (code) do nothing;

create trigger ride_vehicle_types_set_updated_at
  before update on public.ride_vehicle_types
  for each row execute function public.handle_updated_at();

-- ===========================================================================
-- Drivers
-- ===========================================================================

create table if not exists public.ride_driver_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended', 'rejected')),
  vehicle_type text not null references public.ride_vehicle_types (code),
  -- As written on the plate; uppercased and trimmed by the API.
  plate_number text not null check (length(btrim(plate_number)) between 2 and 20),
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  vehicle_year integer check (vehicle_year is null or vehicle_year between 1950 and 2100),
  -- Contact number the rider sees once a ride is accepted, and not before.
  phone text not null check (length(btrim(phone)) between 5 and 20),
  -- S3 keys. Required to move out of 'pending'; the admin approval route
  -- checks they are present rather than trusting the client to have sent them.
  licence_photo text,
  vehicle_photo text,
  registration_photo text,
  -- Rolling aggregates so the driver card does not need a scan of `rides`.
  rating_sum integer not null default 0 check (rating_sum >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_rides integer not null default 0 check (completed_rides >= 0),
  cancelled_rides integer not null default 0 check (cancelled_rides >= 0),
  -- Overrides ride_vehicle_types.commission_rate for this driver when set —
  -- how you run a promotion for early drivers without repricing everyone.
  commission_rate numeric(4, 3)
    check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 1)),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  -- Shown to the driver so a rejection is actionable rather than mysterious.
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ride_driver_profiles_status_idx
  on public.ride_driver_profiles (status, created_at desc);

create trigger ride_driver_profiles_set_updated_at
  before update on public.ride_driver_profiles
  for each row execute function public.handle_updated_at();

-- One row per driver, overwritten in place every few seconds while online.
--
-- fillfactor 70 leaves free space on each page so the update can be a HOT
-- update — the row is rewritten without touching the indexes. Without it, a
-- fleet heartbeating every 4s turns this table into a bloat generator that
-- autovacuum chases forever.
--
-- vehicle_type and is_available are denormalised from ride_driver_profiles so
-- the nearest-driver search never joins.
create table if not exists public.ride_driver_locations (
  driver_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Degrees clockwise from north; rotates the car icon on the rider's map.
  heading double precision check (heading is null or (heading >= 0 and heading < 360)),
  speed double precision check (speed is null or speed >= 0),   -- m/s
  accuracy double precision check (accuracy is null or accuracy >= 0), -- m
  vehicle_type text not null references public.ride_vehicle_types (code),
  -- Driver has Driver Mode switched on.
  is_online boolean not null default false,
  -- Online AND not currently on a ride. Set false when a ride is accepted and
  -- true again when it reaches a terminal state.
  is_available boolean not null default false,
  -- Battery level, so dispatch can prefer a driver who will not die mid-trip
  -- and so support can explain why someone dropped off the map.
  battery_pct integer check (battery_pct is null or battery_pct between 0 and 100),
  updated_at timestamptz not null default now()
) with (fillfactor = 70);

-- The dispatch query: available drivers of one vehicle type inside a lat/lng
-- box. Partial so the index only carries drivers who can actually be offered a
-- ride, which keeps it small and hot in cache.
create index if not exists ride_driver_locations_search_idx
  on public.ride_driver_locations (vehicle_type, latitude, longitude)
  where is_online and is_available;

-- Sweeping stale heartbeats (a driver whose app was killed still reads
-- "online" until something marks them offline).
create index if not exists ride_driver_locations_stale_idx
  on public.ride_driver_locations (updated_at)
  where is_online;

-- ===========================================================================
-- Rides
-- ===========================================================================

-- Trip states, and the only legal moves between them:
--
--   requested ──> accepted ──> arrived ──> in_progress ──> completed
--       │             │            │             │
--       ├─> expired   └────────────┴─────────────┴──────> cancelled
--       └─> cancelled
--
-- `expired` means dispatch ran out of drivers to ask. It is separate from
-- `cancelled` because "nobody was available" and "the rider changed their
-- mind" are different numbers to a business, and merging them hides a supply
-- problem behind a demand statistic.
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  driver_id uuid references public.profiles (id) on delete set null,
  vehicle_type text not null references public.ride_vehicle_types (code),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'arrived', 'in_progress',
                      'completed', 'cancelled', 'expired')),

  -- --- Where ---
  pickup_lat double precision not null check (pickup_lat between -90 and 90),
  pickup_lng double precision not null check (pickup_lng between -180 and 180),
  pickup_address text not null check (length(btrim(pickup_address)) >= 2),
  dropoff_lat double precision not null check (dropoff_lat between -90 and 90),
  dropoff_lng double precision not null check (dropoff_lng between -180 and 180),
  dropoff_address text not null check (length(btrim(dropoff_address)) >= 2),
  -- Encoded polyline from the routing provider, drawn on both maps. Text
  -- rather than a geometry column so no PostGIS dependency.
  route_polyline text,

  -- --- What it should cost, and what it did ---
  -- Quoted up front from the route estimate. The rider agrees to THIS number,
  -- so it is stored before a driver is found and never recalculated after.
  quoted_fare numeric(12, 2) not null check (quoted_fare >= 0),
  quoted_distance_m integer not null check (quoted_distance_m >= 0),
  quoted_duration_s integer not null check (quoted_duration_s >= 0),
  surge_multiplier numeric(4, 2) not null default 1.00
    check (surge_multiplier >= 1 and surge_multiplier <= 5),
  -- Filled at completion from the actual GPS track. Kept separate from the
  -- quote so a dispute has both numbers.
  final_fare numeric(12, 2) check (final_fare is null or final_fare >= 0),
  actual_distance_m integer check (actual_distance_m is null or actual_distance_m >= 0),
  actual_duration_s integer check (actual_duration_s is null or actual_duration_s >= 0),
  -- The platform's cut of final_fare, resolved at settlement from the driver's
  -- override or the vehicle type's rate. Stored so a later rate change does not
  -- silently rewrite history.
  commission numeric(12, 2) check (commission is null or commission >= 0),

  -- --- Money ---
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'gpay')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'settled', 'failed', 'waived')),
  -- Set when settlement fails, so support can see why without reading logs.
  payment_error text,

  -- --- Notes and cancellation ---
  rider_note text check (rider_note is null or length(rider_note) <= 500),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('rider', 'driver', 'system', 'admin')),
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300),
  cancel_fee numeric(12, 2) not null default 0 check (cancel_fee >= 0),

  -- --- Ratings (1–5, one each way, set once) ---
  rider_rating smallint check (rider_rating is null or rider_rating between 1 and 5),
  rider_comment text check (rider_comment is null or length(rider_comment) <= 500),
  driver_rating smallint check (driver_rating is null or driver_rating between 1 and 5),
  driver_comment text check (driver_comment is null or length(driver_comment) <= 500),

  -- --- Transition timestamps, all written by the state trigger ---
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A driver is mandatory from `accepted` onward and impossible before it.
  constraint rides_driver_matches_status check (
    (status in ('requested', 'expired') and driver_id is null)
    or (status in ('accepted', 'arrived', 'in_progress', 'completed') and driver_id is not null)
    or status = 'cancelled'
  ),
  -- A completed ride must have a settled number attached to it.
  constraint rides_completed_has_fare check (
    status <> 'completed' or final_fare is not null
  ),
  -- You cannot be your own driver.
  constraint rides_no_self_drive check (driver_id is null or driver_id <> rider_id)
);

-- "My rides", newest first — the history screen on both sides.
create index if not exists rides_rider_idx on public.rides (rider_id, created_at desc);
create index if not exists rides_driver_idx on public.rides (driver_id, created_at desc)
  where driver_id is not null;
-- The dispatcher's queue: rides still looking for a driver, oldest first.
create index if not exists rides_pending_idx on public.rides (requested_at)
  where status = 'requested';
-- Admin: live board of everything in flight.
create index if not exists rides_active_idx on public.rides (status, requested_at desc)
  where status in ('requested', 'accepted', 'arrived', 'in_progress');
-- Settlement sweeper: completed rides whose money has not moved yet.
create index if not exists rides_unsettled_idx on public.rides (completed_at)
  where status = 'completed' and payment_status = 'pending';

create trigger rides_set_updated_at
  before update on public.rides
  for each row execute function public.handle_updated_at();

-- --- The state machine -----------------------------------------------------

-- Rejects illegal transitions and stamps the timestamps itself. This is the
-- single reason a driver cannot skip `arrived`/`in_progress` and bill for a
-- trip that never took place, no matter what the client sends.
create or replace function public.ride_guard_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- Terminal states are terminal. Reopening a completed ride would let money
  -- move twice.
  if old.status in ('completed', 'cancelled', 'expired') then
    raise exception 'Ride % is already %, it cannot become %',
      old.id, old.status, new.status;
  end if;

  if not (
    (old.status = 'requested'   and new.status in ('accepted', 'cancelled', 'expired'))
    or (old.status = 'accepted'    and new.status in ('arrived', 'cancelled'))
    or (old.status = 'arrived'     and new.status in ('in_progress', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Illegal ride transition: % -> %', old.status, new.status;
  end if;

  -- The driver is fixed at acceptance. Swapping it afterwards would reassign
  -- the earnings of a trip somebody else drove.
  if old.driver_id is not null and new.driver_id is distinct from old.driver_id then
    raise exception 'The driver of a ride cannot be changed once assigned';
  end if;

  -- Timestamps are set here, never by the caller.
  if new.status = 'accepted'    then new.accepted_at  := now(); end if;
  if new.status = 'arrived'     then new.arrived_at   := now(); end if;
  if new.status = 'in_progress' then new.started_at   := now(); end if;
  if new.status = 'completed'   then new.completed_at := now(); end if;
  if new.status in ('cancelled', 'expired') then
    new.cancelled_at := now();
    if new.status = 'cancelled' and new.cancelled_by is null then
      raise exception 'A cancelled ride must record who cancelled it';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rides_guard_transition on public.rides;
create trigger rides_guard_transition
  before update on public.rides
  for each row execute function public.ride_guard_transition();

-- ===========================================================================
-- Dispatch offers
-- ===========================================================================

-- One row per driver the dispatcher asked. Kept after the ride ends: an
-- acceptance rate is the main lever for driver quality, and a rider complaining
-- "nobody came" is answered by showing who was asked and what they did.
create table if not exists public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  -- Straight-line metres at the moment of the offer; explains the ordering.
  distance_m integer not null check (distance_m >= 0),
  -- Which round of dispatch this was (1 = closest driver asked first).
  attempt integer not null default 1 check (attempt >= 1),
  response text not null default 'pending'
    check (response in ('pending', 'accepted', 'declined', 'timeout', 'cancelled')),
  sent_at timestamptz not null default now(),
  -- The dispatcher moves on at this instant whether or not the driver replied.
  expires_at timestamptz not null,
  responded_at timestamptz,
  -- Never ask the same driver about the same ride twice.
  unique (ride_id, driver_id)
);

create index if not exists ride_offers_driver_idx
  on public.ride_offers (driver_id, sent_at desc);
-- The dispatcher's tick: offers that are still open and now overdue.
create index if not exists ride_offers_open_idx
  on public.ride_offers (expires_at)
  where response = 'pending';

-- ===========================================================================
-- Money: driver balances and the ledger
-- ===========================================================================

-- What each driver owes the platform (cash rides) or is owed by it.
--
-- commission_owed only ever grows from cash rides and shrinks when the driver
-- settles. A driver whose debt passes the admin's threshold stops receiving
-- offers — that check lives in the dispatcher, not here, because it is a
-- business rule and this is a balance.
create table if not exists public.ride_driver_balances (
  driver_id uuid primary key references public.profiles (id) on delete cascade,
  commission_owed numeric(14, 2) not null default 0 check (commission_owed >= 0),
  -- Lifetime totals, for the driver's earnings screen.
  lifetime_gross numeric(14, 2) not null default 0 check (lifetime_gross >= 0),
  lifetime_commission numeric(14, 2) not null default 0 check (lifetime_commission >= 0),
  updated_at timestamptz not null default now()
);

-- Append-only. Every movement of ride money leaves a row here, and nothing
-- deletes from it. `amount` is signed from the DRIVER's point of view:
-- positive = the driver gained, negative = the driver owes or paid.
create table if not exists public.ride_ledger (
  id bigserial primary key,
  ride_id uuid references public.rides (id) on delete set null,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'fare_cash',      -- driver collected cash from the rider
    'fare_wallet',    -- rider's wallet paid the driver
    'commission',     -- platform's cut (always negative)
    'settlement',     -- driver paid down commission_owed (negative)
    'cancel_fee',     -- rider's cancellation fee paid to the driver
    'adjustment'      -- admin correction; note is mandatory
  )),
  amount numeric(14, 2) not null,
  -- The driver's commission_owed AFTER this row was applied, so the statement
  -- can be read top to bottom without re-deriving every balance.
  balance_after numeric(14, 2) not null,
  -- Links to the gpay_transactions row when wallet money actually moved.
  gpay_txn uuid,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ride_ledger_adjustment_needs_note check (
    kind <> 'adjustment' or (note is not null and length(btrim(note)) > 0)
  )
);

create index if not exists ride_ledger_driver_idx
  on public.ride_ledger (driver_id, created_at desc);
create index if not exists ride_ledger_ride_idx
  on public.ride_ledger (ride_id);

-- ===========================================================================
-- Platform settings
-- ===========================================================================

-- Single row (id = true). Holds the things an admin tunes at runtime and the
-- platform's own G-Pay account, without which wallet commission would have
-- nowhere to land and the wallet balances would stop summing to zero.
create table if not exists public.ride_settings (
  id boolean primary key default true check (id),
  -- Wallet commission is credited here. ride_settle() refuses to run a wallet
  -- ride while this is null rather than quietly making money disappear.
  platform_gpay_account uuid references public.gpay_accounts (id) on delete set null,
  -- Dispatch tuning.
  search_radius_m integer not null default 5000 check (search_radius_m between 200 and 50000),
  offer_timeout_s integer not null default 15 check (offer_timeout_s between 5 and 120),
  max_offer_attempts integer not null default 6 check (max_offer_attempts between 1 and 20),
  -- A heartbeat older than this means the driver is gone, whatever is_online says.
  driver_stale_after_s integer not null default 60
    check (driver_stale_after_s between 15 and 600),
  -- Debt ceiling: past this, a driver stops receiving cash-ride offers.
  max_commission_owed numeric(14, 2) not null default 50000
    check (max_commission_owed >= 0),
  -- Master switch, so support can stop new rides without a deploy.
  accepting_rides boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.ride_settings (id) values (true) on conflict (id) do nothing;

create trigger ride_settings_set_updated_at
  before update on public.ride_settings
  for each row execute function public.handle_updated_at();

-- ===========================================================================
-- Functions
-- ===========================================================================

-- Nearest available drivers to a point.
--
-- Bounding box first (index scan), haversine second (arithmetic on the handful
-- of rows the box returned). Doing it the other way round — computing distance
-- for every driver then sorting — is the mistake that makes people think they
-- need Redis on day one.
create or replace function public.ride_nearest_drivers(
  p_lat double precision,
  p_lng double precision,
  p_vehicle_type text,
  p_radius_m integer default 5000,
  p_limit integer default 10,
  p_stale_after_s integer default 60
)
returns table (
  driver_id uuid,
  latitude double precision,
  longitude double precision,
  heading double precision,
  distance_m double precision,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  with box as (
    select
      -- One degree of latitude is ~111,320 m everywhere.
      p_radius_m / 111320.0 as d_lat,
      -- Degrees of longitude shrink as you leave the equator. The 0.000001
      -- floor stops a division by zero at the poles, where no taxi has ever
      -- been requested but a NaN would still break the query.
      p_radius_m / greatest(111320.0 * cos(radians(p_lat)), 0.000001) as d_lng
  )
  select
    l.driver_id,
    l.latitude,
    l.longitude,
    l.heading,
    -- Haversine, in metres. Earth radius 6371000.
    2 * 6371000 * asin(
      sqrt(
        power(sin(radians(l.latitude - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(l.latitude))
          * power(sin(radians(l.longitude - p_lng) / 2), 2)
      )
    ) as distance_m,
    l.updated_at
  from public.ride_driver_locations l, box b
  where l.is_online
    and l.is_available
    and l.vehicle_type = p_vehicle_type
    and l.updated_at > now() - make_interval(secs => p_stale_after_s)
    and l.latitude between p_lat - b.d_lat and p_lat + b.d_lat
    and l.longitude between p_lng - b.d_lng and p_lng + b.d_lng
  order by distance_m
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.ride_nearest_drivers(
  double precision, double precision, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.ride_nearest_drivers(
  double precision, double precision, text, integer, integer, integer)
  to service_role;

-- Settle a completed ride: move the money and write the ledger, exactly once.
--
-- Called by /api/ride/settle after the ride reaches `completed`. Locks the ride
-- row and refuses to run twice, so a retried request cannot pay a driver twice.
create or replace function public.ride_settle(p_ride uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_settings public.ride_settings;
  v_rate numeric(4, 3);
  v_commission numeric(14, 2);
  v_net numeric(14, 2);
  v_owed numeric(14, 2);
  v_rider_acct public.gpay_accounts;
  v_driver_acct public.gpay_accounts;
  v_txn uuid;
begin
  -- FOR UPDATE is what makes double settlement impossible: a second concurrent
  -- call blocks here and then fails the payment_status check below.
  select * into v_ride from public.rides where id = p_ride for update;
  if not found then
    raise exception 'Ride % not found', p_ride;
  end if;
  if v_ride.status <> 'completed' then
    raise exception 'Ride % is %, only a completed ride can be settled', p_ride, v_ride.status;
  end if;
  if v_ride.payment_status <> 'pending' then
    raise exception 'Ride % is already %', p_ride, v_ride.payment_status;
  end if;
  if v_ride.final_fare is null then
    raise exception 'Ride % has no final fare', p_ride;
  end if;

  select * into v_settings from public.ride_settings where id;

  -- Driver override first, then the vehicle type's rate.
  select coalesce(
      (select d.commission_rate from public.ride_driver_profiles d where d.user_id = v_ride.driver_id),
      (select t.commission_rate from public.ride_vehicle_types t where t.code = v_ride.vehicle_type)
    )
    into v_rate;

  v_commission := round(v_ride.final_fare * v_rate, 2);
  v_net := v_ride.final_fare - v_commission;

  insert into public.ride_driver_balances (driver_id)
    values (v_ride.driver_id)
    on conflict (driver_id) do nothing;

  if v_ride.payment_method = 'gpay' then
    -- Wallet ride. Rider pays the full fare; the driver receives the net and
    -- the platform receives the commission. Three balances move, and they sum
    -- to zero — which is only true because the platform has a real account.
    if v_settings.platform_gpay_account is null then
      raise exception 'No platform G-Pay account configured; set ride_settings.platform_gpay_account before taking wallet rides';
    end if;

    select * into v_rider_acct from public.gpay_accounts
      where user_id = v_ride.rider_id and status = 'active';
    if not found then
      raise exception 'Rider has no active G-Pay account';
    end if;
    select * into v_driver_acct from public.gpay_accounts
      where user_id = v_ride.driver_id and status = 'active';
    if not found then
      raise exception 'Driver has no active G-Pay account';
    end if;
    if v_rider_acct.balance < v_ride.final_fare then
      raise exception 'Rider has insufficient G-Pay balance';
    end if;

    perform set_config('gpay.allow_ledger', 'on', true);
    update public.gpay_accounts set balance = balance - v_ride.final_fare
      where id = v_rider_acct.id;
    update public.gpay_accounts set balance = balance + v_net
      where id = v_driver_acct.id;
    update public.gpay_accounts set balance = balance + v_commission
      where id = v_settings.platform_gpay_account;

    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('transfer', v_rider_acct.id, v_driver_acct.id, v_net,
              'Ride ' || p_ride::text)
      returning id into v_txn;
    if v_commission > 0 then
      insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
        values ('fee', v_rider_acct.id, v_settings.platform_gpay_account, v_commission,
                'Ride commission ' || p_ride::text);
    end if;

    -- Wallet commission is taken at source, so the driver's debt is unchanged.
    select commission_owed into v_owed from public.ride_driver_balances
      where driver_id = v_ride.driver_id;

    insert into public.ride_ledger (ride_id, driver_id, kind, amount, balance_after, gpay_txn, note)
      values (p_ride, v_ride.driver_id, 'fare_wallet', v_net, v_owed, v_txn, null);
    if v_commission > 0 then
      insert into public.ride_ledger (ride_id, driver_id, kind, amount, balance_after, note)
        values (p_ride, v_ride.driver_id, 'commission', -v_commission, v_owed,
                'deducted at source');
    end if;
  else
    -- Cash ride. No wallet money moves — the driver already has the notes in
    -- their hand. What changes is that they now owe the platform its cut.
    update public.ride_driver_balances
      set commission_owed = commission_owed + v_commission,
          updated_at = now()
      where driver_id = v_ride.driver_id
      returning commission_owed into v_owed;

    insert into public.ride_ledger (ride_id, driver_id, kind, amount, balance_after, note)
      values (p_ride, v_ride.driver_id, 'fare_cash', v_ride.final_fare, v_owed,
              'collected in cash');
    insert into public.ride_ledger (ride_id, driver_id, kind, amount, balance_after, note)
      values (p_ride, v_ride.driver_id, 'commission', -v_commission, v_owed,
              'owed to platform');
  end if;

  update public.ride_driver_balances
    set lifetime_gross = lifetime_gross + v_ride.final_fare,
        lifetime_commission = lifetime_commission + v_commission,
        updated_at = now()
    where driver_id = v_ride.driver_id;

  update public.rides
    set commission = v_commission,
        payment_status = 'settled',
        payment_error = null
    where id = p_ride;

  update public.ride_driver_profiles
    set completed_rides = completed_rides + 1
    where user_id = v_ride.driver_id;
end;
$$;

revoke execute on function public.ride_settle(uuid) from public, anon, authenticated;
grant execute on function public.ride_settle(uuid) to service_role;

-- A driver pays down what they owe on cash rides, out of their G-Pay wallet.
create or replace function public.ride_driver_settle(p_driver uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.ride_settings;
  v_acct public.gpay_accounts;
  v_owed numeric(14, 2);
  v_txn uuid;
begin
  if p_amount is null or p_amount < 0.01 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid amount';
  end if;

  select * into v_settings from public.ride_settings where id;
  if v_settings.platform_gpay_account is null then
    raise exception 'No platform G-Pay account configured';
  end if;

  select commission_owed into v_owed from public.ride_driver_balances
    where driver_id = p_driver for update;
  if not found then
    raise exception 'Driver has no balance record';
  end if;
  if p_amount > v_owed then
    raise exception 'That is more than the % owed', v_owed;
  end if;

  select * into v_acct from public.gpay_accounts
    where user_id = p_driver and status = 'active';
  if not found then
    raise exception 'Driver has no active G-Pay account';
  end if;
  if v_acct.balance < p_amount then
    raise exception 'Insufficient G-Pay balance';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - p_amount where id = v_acct.id;
  update public.gpay_accounts set balance = balance + p_amount
    where id = v_settings.platform_gpay_account;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('fee', v_acct.id, v_settings.platform_gpay_account, p_amount,
            'Ride commission settlement')
    returning id into v_txn;

  update public.ride_driver_balances
    set commission_owed = commission_owed - p_amount,
        updated_at = now()
    where driver_id = p_driver
    returning commission_owed into v_owed;

  insert into public.ride_ledger (driver_id, kind, amount, balance_after, gpay_txn, note)
    values (p_driver, 'settlement', -p_amount, v_owed, v_txn, 'paid from wallet');
end;
$$;

revoke execute on function public.ride_driver_settle(uuid, numeric) from public, anon, authenticated;
grant execute on function public.ride_driver_settle(uuid, numeric) to service_role;

-- Fold a rating into the driver's rolling aggregate. Called once, when the
-- rider rates; `rides.rider_rating` being non-null already is what stops a
-- rider from voting twice.
create or replace function public.ride_apply_rating(p_ride uuid, p_rating smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1-5';
  end if;

  update public.rides
    set rider_rating = p_rating
    where id = p_ride and status = 'completed' and rider_rating is null
    returning driver_id into v_driver;
  if v_driver is null then
    raise exception 'Ride % cannot be rated', p_ride;
  end if;

  update public.ride_driver_profiles
    set rating_sum = rating_sum + p_rating,
        rating_count = rating_count + 1
    where user_id = v_driver;
end;
$$;

revoke execute on function public.ride_apply_rating(uuid, smallint) from public, anon, authenticated;
grant execute on function public.ride_apply_rating(uuid, smallint) to service_role;

-- ===========================================================================
-- RLS: enabled, zero policies. Everything goes through /api/ride/*.
-- ===========================================================================

alter table public.ride_vehicle_types    enable row level security;
alter table public.ride_driver_profiles  enable row level security;
alter table public.ride_driver_locations enable row level security;
alter table public.rides                 enable row level security;
alter table public.ride_offers           enable row level security;
alter table public.ride_driver_balances  enable row level security;
alter table public.ride_ledger           enable row level security;
alter table public.ride_settings         enable row level security;
