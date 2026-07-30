-- Community cannabis map: dispensaries, farms and clinics.
--
-- Crowdsourced like the WiFi map — any signed-in adult can add a place or
-- correct one, and anyone can report a bad entry for an admin to remove. What
-- keeps it usable is that a listing is only accepted COMPLETE: name, kind,
-- address, phone, exact coordinates and at least one photo. The API enforces
-- that; the CHECK constraints here make it true at the storage layer too, so a
-- future writer can't quietly add a half-empty pin.
--
-- Both tables have RLS enabled with ZERO policies: invisible to PostgREST, so
-- every read and write goes through /api/cannabis/places, which checks the
-- caller is an adult (and an admin for deletes). One gate, one place.
--
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.cannabis_places (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('shop', 'farm', 'clinic')),
  name text not null check (length(btrim(name)) >= 2),
  -- Full details are the point of the map; empty strings are not addresses.
  address text not null check (length(btrim(address)) >= 5),
  phone text not null check (length(btrim(phone)) >= 6),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Storage keys or absolute URLs; at least one, capped so a listing can't
  -- become an album. Element checks mirror shop-media.sql's array guards.
  photos text[] not null default '{}'
    check (
      coalesce(array_length(photos, 1), 0) between 1 and 8
      and array_position(photos, null) is null
      and '' <> all (photos)
    ),
  description text,
  hours text,                              -- "09:00–22:00 daily"
  website text,
  -- Free-form, comma-separated: "delivery, medical, THC flower, CBD".
  tags text,
  city text,
  country text not null default 'TH',      -- most of the user base is in Thailand
  -- Who filed it and who last touched it: an edit history of two, which is
  -- enough to answer "who typed this" without a full audit table.
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  -- Reports accumulate here so the admin queue is one indexed query.
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Map viewport (bounding-box) lookups.
create index if not exists cannabis_places_lat_lng_idx
  on public.cannabis_places (latitude, longitude);

-- Browse by kind, newest first.
create index if not exists cannabis_places_kind_idx
  on public.cannabis_places (kind, created_at desc);

-- The admin moderation queue: most-reported first.
create index if not exists cannabis_places_reports_idx
  on public.cannabis_places (report_count desc, updated_at desc);

alter table public.cannabis_places enable row level security;
-- Deliberately no policies: server-only, through the API route.

-- One row per report, so a single angry user can't inflate the count and the
-- admin can read why a place was flagged.
create table if not exists public.cannabis_place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.cannabis_places(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (length(btrim(reason)) >= 3),
  created_at timestamptz not null default now(),
  -- One report per person per place: re-reporting updates the reason.
  unique (place_id, reporter_id)
);

create index if not exists cannabis_place_reports_place_idx
  on public.cannabis_place_reports (place_id, created_at desc);

alter table public.cannabis_place_reports enable row level security;
-- Deliberately no policies: server-only.
