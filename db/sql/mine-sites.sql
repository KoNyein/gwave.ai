-- Community mine-site map: where Myanmar's minerals actually come from.
--
-- The metal board tells a trader what tin or antimony is worth; this tells them
-- where it is dug. Crowdsourced the same way as the cannabis map and the WiFi
-- map — any signed-in user can add a site, correct one, or report a bad entry
-- for an admin to remove.
--
-- A pin is only accepted COMPLETE: metal, name, township, exact coordinates and
-- at least one photo. The API enforces that; the CHECK constraints here make it
-- true at the storage layer too, so a future writer can't quietly add a
-- half-empty pin.
--
-- Safety note baked into the shape: `access` and `hazard` are free text, and
-- the UI labels them as user-reported, not verified. A mine map that pretends
-- to know whether a road is safe would get someone hurt.
--
-- Both tables have RLS enabled with ZERO policies: invisible to PostgREST, so
-- every read and write goes through /api/mine/sites. One gate, one place.
--
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.mine_sites (
  id uuid primary key default gen_random_uuid(),
  -- Matches the metal board's mineral list; free text rather than an enum so a
  -- new mineral doesn't need a migration, but constrained to the known set so
  -- the filter chips stay meaningful.
  metal text not null check (
    metal in (
      'tin', 'antimony', 'rare_earth', 'tungsten', 'copper', 'gold',
      'zinc_lead', 'nickel', 'jade', 'ruby', 'sapphire', 'amber',
      'coal', 'silver', 'iron', 'other'
    )
  ),
  name text not null check (length(btrim(name)) >= 2),
  -- Where it is, in the way Myanmar addresses actually work: state/region and
  -- township, not a street line.
  region text not null check (length(btrim(region)) >= 2),   -- ကချင်ပြည်နယ်
  township text not null check (length(btrim(township)) >= 2), -- ဖားကန့်
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Storage keys or absolute URLs; at least one, capped so a listing can't
  -- become an album. Element checks mirror cannabis-places.sql's array guards.
  photos text[] not null default '{}'
    check (
      coalesce(array_length(photos, 1), 0) between 1 and 8
      and array_position(photos, null) is null
      and '' <> all (photos)
    ),
  -- artisanal = ရိုးရာ/လက်လုပ်, small = သေးစား, industrial = စက်မှုလုပ်ငန်း
  scale text not null default 'unknown'
    check (scale in ('artisanal', 'small', 'industrial', 'unknown')),
  status text not null default 'unknown'
    check (status in ('active', 'seasonal', 'suspended', 'abandoned', 'unknown')),
  operator text,          -- company / cooperative / family, as reported
  description text,
  -- User-reported, never verified: how you get there, and what to watch for
  -- (landslides, tailings ponds, unexploded ordnance, checkpoints).
  access text,
  hazard text,
  -- Free-form, comma-separated: "open pit, alluvial, hand dug".
  tags text,
  country text not null default 'MM',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  -- Reports accumulate here so the admin queue is one indexed query.
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Map viewport (bounding-box) lookups.
create index if not exists mine_sites_lat_lng_idx
  on public.mine_sites (latitude, longitude);

-- Browse by mineral, newest first — the primary filter in the UI.
create index if not exists mine_sites_metal_idx
  on public.mine_sites (metal, created_at desc);

-- "What is being mined in Kachin" — the second most common question.
create index if not exists mine_sites_region_idx
  on public.mine_sites (region, township);

-- The admin moderation queue: most-reported first.
create index if not exists mine_sites_reports_idx
  on public.mine_sites (report_count desc, updated_at desc);

alter table public.mine_sites enable row level security;
-- Deliberately no policies: server-only, through the API route.

-- One row per report, so a single angry user can't inflate the count and the
-- admin can read why a site was flagged.
create table if not exists public.mine_site_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.mine_sites(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (length(btrim(reason)) >= 3),
  created_at timestamptz not null default now(),
  -- One report per person per site: re-reporting updates the reason.
  unique (site_id, reporter_id)
);

create index if not exists mine_site_reports_site_idx
  on public.mine_site_reports (site_id, created_at desc);

alter table public.mine_site_reports enable row level security;
-- Deliberately no policies: server-only.
