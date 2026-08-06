-- ═══════════════════════════════════════════════════════════════════════
-- gWave Studio — cloud world saves (public/engine/studio.html)
--
-- Run on EC2 (the Claude container cannot reach RDS):
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h <rds-host> -U gwaveadmin -d gwave -f - < engine-worlds.sql
--   sudo docker restart postgrest        # DDL → schema cache refresh
--
-- House convention: RLS sealed, service_role grants only — the Next.js
-- routes (/api/engine/worlds) go through the admin client and enforce
-- ownership in code. No anon/authenticated access.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists engine_worlds (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name       text not null default 'Untitled',
  data       jsonb not null,                 -- serialized Studio scene
  thumb      text,                           -- data:image/jpeg thumbnail
  visibility text not null default 'private'
             check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists engine_worlds_profile_idx
  on engine_worlds (profile_id, updated_at desc);

alter table engine_worlds enable row level security;
revoke all on engine_worlds from anon, authenticated;
grant all on engine_worlds to service_role;
