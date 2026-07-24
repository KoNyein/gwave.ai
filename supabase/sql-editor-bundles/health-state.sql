-- health_state — one JSON snapshot per user of their whole Health module.
-- The mobile app mirrors every local change here (auto-save / auto-update) and
-- restores it on sign-in, so health data survives logout→login, a reinstall, or
-- a new phone instead of disappearing. Owner-only RLS: a user can only see and
-- write their own row.
--
-- Apply on EC2:
--   curl -s https://raw.githubusercontent.com/KoNyein/gwave.ai/claude/phase-1-implementation-7ysxtj/supabase/sql-editor-bundles/health-state.sql | psql "$HOSTDB"
--   sudo docker restart postgrest

create table if not exists public.health_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.health_state enable row level security;

drop policy if exists health_state_select_own on public.health_state;
create policy health_state_select_own on public.health_state
  for select using (user_id = auth.uid());

drop policy if exists health_state_insert_own on public.health_state;
create policy health_state_insert_own on public.health_state
  for insert with check (user_id = auth.uid());

drop policy if exists health_state_update_own on public.health_state;
create policy health_state_update_own on public.health_state
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.health_state to authenticated;
