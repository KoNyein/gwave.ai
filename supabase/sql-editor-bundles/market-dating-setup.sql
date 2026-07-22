-- ---------------------------------------------------------------------------
-- Marketplace (user-to-user listings) + Dating — table setup.
--
-- Run as the RDS master user (gwaveadmin): the PostgREST `authenticator` and
-- `service_role` cannot CREATE in schema public on this cluster. After running,
-- restart PostgREST so its schema cache learns the new tables:
--
--   sudo docker restart postgrest
-- ---------------------------------------------------------------------------

-- ============================ Marketplace ==================================
-- Facebook-Marketplace-style person-to-person listings, separate from the
-- dropship/affiliate shop. Photos are storage keys in the `media` bucket.
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  price numeric(14, 2) not null default 0 check (price >= 0),
  currency text not null default 'MMK' check (char_length(currency) between 3 and 8),
  category text not null default 'other' check (char_length(category) <= 40),
  location text not null default '' check (char_length(location) <= 160),
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'sold', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_listings_feed_idx
  on public.market_listings (status, created_at desc);
create index if not exists market_listings_seller_idx
  on public.market_listings (seller_id, created_at desc);

alter table public.market_listings enable row level security;

drop policy if exists market_listings_read on public.market_listings;
create policy market_listings_read on public.market_listings
  for select to authenticated
  using (status = 'active' or seller_id = auth.uid());

drop policy if exists market_listings_service on public.market_listings;
create policy market_listings_service on public.market_listings
  for all to service_role using (true) with check (true);

-- ============================== Dating =====================================
-- Opt-in dating profile (18+, checked API-side on the birth year), one per
-- account. Swipes are one row per (swiper, target); a mutual like creates a
-- match row with the pair stored in sorted order so it's unique either way.
create table if not exists public.dating_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  birth_year int not null check (birth_year between 1920 and 2012),
  gender text not null check (gender in ('male', 'female', 'other')),
  looking_for text not null default 'any' check (looking_for in ('male', 'female', 'any')),
  bio text not null default '' check (char_length(bio) <= 2000),
  city text not null default '' check (char_length(city) <= 120),
  photos jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dating_swipes (
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id)
);

create index if not exists dating_swipes_target_idx
  on public.dating_swipes (target_id, liked);

create table if not exists public.dating_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists dating_matches_a_idx on public.dating_matches (user_a);
create index if not exists dating_matches_b_idx on public.dating_matches (user_b);

-- Dating data is private: no authenticated policies — every read/write goes
-- through the service-role mobile API, which scopes rows to the caller.
alter table public.dating_profiles enable row level security;
alter table public.dating_swipes enable row level security;
alter table public.dating_matches enable row level security;

drop policy if exists dating_profiles_service on public.dating_profiles;
create policy dating_profiles_service on public.dating_profiles
  for all to service_role using (true) with check (true);

drop policy if exists dating_swipes_service on public.dating_swipes;
create policy dating_swipes_service on public.dating_swipes
  for all to service_role using (true) with check (true);

drop policy if exists dating_matches_service on public.dating_matches;
create policy dating_matches_service on public.dating_matches
  for all to service_role using (true) with check (true);

-- ============================== Grants =====================================
grant select, insert, update, delete on public.market_listings
  to authenticated, service_role;
grant select on public.market_listings to anon;
grant select, insert, update, delete on public.dating_profiles to service_role;
grant select, insert, update, delete on public.dating_swipes to service_role;
grant select, insert, update, delete on public.dating_matches to service_role;
