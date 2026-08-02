-- Health activity journal: THC/medication/meal/exercise/etc. events, mirrored
-- from the mobile Health module so they survive a reinstall and can be reviewed
-- from any device. Owner-only RLS, same pattern as public.health_vitals.
--
-- Run on EC2 with the dockerised psql, then: sudo docker restart postgrest
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h <rds-host> -U gwaveadmin -d gwave -f - < health-events.sql

create table if not exists public.health_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null,          -- cannabis | medication | meal | exercise | caffeine | alcohol | symptom | other
  note         text,
  detail       text,                   -- dose / amount / duration
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
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
