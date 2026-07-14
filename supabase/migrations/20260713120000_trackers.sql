-- Physical location trackers a user can attach to bags, vehicles, pets, tools:
-- Bluetooth GPS tags, Wi-Fi trackers, NFC tags, AirTags, etc. Each is owned by
-- one user (owner-only RLS); the app records a last-known location + battery.

create type public.tracker_type as enum (
  'bluetooth',
  'wifi',
  'nfc',
  'airtag',
  'other'
);

create table public.trackers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type public.tracker_type not null default 'other',
  -- BLE device id / NFC serial / AirTag label — how the hardware is identified.
  identifier text check (identifier is null or char_length(identifier) <= 200),
  latitude double precision check (latitude >= -90 and latitude <= 90),
  longitude double precision check (longitude >= -180 and longitude <= 180),
  accuracy double precision,
  battery integer check (battery is null or (battery >= 0 and battery <= 100)),
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trackers_owner_idx on public.trackers (owner_id);

create trigger trackers_set_updated_at
  before update on public.trackers
  for each row execute function public.handle_updated_at();

alter table public.trackers enable row level security;

-- Owner-only: a user reads and manages exactly their own trackers.
create policy "Owner manages own trackers"
  on public.trackers
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
