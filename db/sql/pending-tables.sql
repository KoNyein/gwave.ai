-- Combined pending tables (health_events + drone_detections + drone_race_scores)
-- so the operator can apply all three in one go via a single curl → psql.
-- Owner-only RLS on personal tables; public read on the shared drone feed and
-- the race leaderboard.

-- 1) health_events — activity journal (THC / meds / meals / exercise …)
create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  note text,
  detail text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists health_events_user_time
  on public.health_events (user_id, occurred_at desc);
alter table public.health_events enable row level security;
drop policy if exists health_events_select_own on public.health_events;
create policy health_events_select_own on public.health_events
  for select using (user_id = auth.uid());
drop policy if exists health_events_insert_own on public.health_events;
create policy health_events_insert_own on public.health_events
  for insert with check (user_id = auth.uid());
drop policy if exists health_events_delete_own on public.health_events;
create policy health_events_delete_own on public.health_events
  for delete using (user_id = auth.uid());
grant select, insert, delete on public.health_events to authenticated;

-- 2) drone_detections — networked SDR drone feed
create table if not exists public.drone_detections (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'sensor',
  sensor_id text,
  protocol text,
  vendor text,
  label text,
  rssi integer,
  lat double precision,
  lng double precision,
  altitude_m double precision,
  heading_deg double precision,
  speed_ms double precision,
  remote_id text,
  detected_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);
create index if not exists drone_detections_live
  on public.drone_detections (expires_at, detected_at desc);
create index if not exists drone_detections_geo
  on public.drone_detections (lat, lng);
alter table public.drone_detections enable row level security;
drop policy if exists drone_detections_read on public.drone_detections;
create policy drone_detections_read on public.drone_detections
  for select using (expires_at > now());
grant select on public.drone_detections to authenticated;

-- 3) drone_race_scores — Drone Champions leaderboard
create table if not exists public.drone_race_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null,
  best_ms integer not null,
  updated_at timestamptz not null default now(),
  unique (user_id, track)
);
create index if not exists drone_race_scores_track
  on public.drone_race_scores (track, best_ms asc);
alter table public.drone_race_scores enable row level security;
drop policy if exists drone_scores_read on public.drone_race_scores;
create policy drone_scores_read on public.drone_race_scores
  for select using (true);
drop policy if exists drone_scores_insert_own on public.drone_race_scores;
create policy drone_scores_insert_own on public.drone_race_scores
  for insert with check (user_id = auth.uid());
drop policy if exists drone_scores_update_own on public.drone_race_scores;
create policy drone_scores_update_own on public.drone_race_scores
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.drone_race_scores to authenticated;
