-- Drone Champions League leaderboard: each player's best lap time per track in
-- the browser FPV drone simulator (/games/drone-sim). Public read (the ladder),
-- owner-only writes. Run on RDS, then: sudo docker restart postgrest

create table if not exists public.drone_race_scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  track       text not null,
  best_ms     integer not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, track)
);

create index if not exists drone_race_scores_track
  on public.drone_race_scores (track, best_ms asc);

alter table public.drone_race_scores enable row level security;

drop policy if exists drone_scores_read on public.drone_race_scores;
create policy drone_scores_read on public.drone_race_scores
  for select using (true); -- public leaderboard

drop policy if exists drone_scores_insert_own on public.drone_race_scores;
create policy drone_scores_insert_own on public.drone_race_scores
  for insert with check (user_id = auth.uid());

drop policy if exists drone_scores_update_own on public.drone_race_scores;
create policy drone_scores_update_own on public.drone_race_scores
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.drone_race_scores to authenticated;
