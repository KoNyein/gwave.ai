-- Health vitals — per-user measurements (heart rate, BP, SpO2, weight, sugar,
-- respiratory rate, steps, camera-PPG pulse …) synced from the app so a user's
-- readings survive a reinstall and can be reviewed / reported from any device.
--
-- Private by design: owner-only RLS (each user sees and writes only their own
-- rows), same pattern as lesson_progress which the app already writes directly.
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.health_vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,                    -- heart_rate | bp | spo2 | temp | weight | glucose | respiratory | steps
  value double precision not null,       -- primary value (systolic for bp)
  value2 double precision,               -- diastolic for bp, else null
  note text,
  source text default 'manual',          -- manual | camera_ppg
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists health_vitals_user_time_idx
  on public.health_vitals (user_id, recorded_at desc);

alter table public.health_vitals enable row level security;

-- Owner-only: a user reads/writes only their own vitals.
drop policy if exists health_vitals_owner_select on public.health_vitals;
create policy health_vitals_owner_select
  on public.health_vitals for select
  using (user_id = auth.uid());

drop policy if exists health_vitals_owner_insert on public.health_vitals;
create policy health_vitals_owner_insert
  on public.health_vitals for insert
  with check (user_id = auth.uid());

drop policy if exists health_vitals_owner_delete on public.health_vitals;
create policy health_vitals_owner_delete
  on public.health_vitals for delete
  using (user_id = auth.uid());

-- Let the app read/write it through PostgREST.
grant select, insert, delete on public.health_vitals to authenticated;
