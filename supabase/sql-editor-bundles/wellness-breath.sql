-- Wellness breathing sessions — auto-saved to the server so a user's practice
-- history, best retention and streak survive across devices (like health data).
-- Owner-only RLS. Apply on EC2 + `sudo docker restart postgrest`.

create table if not exists public.breath_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  method     text not null default 'wim_hof',
  rounds     integer not null,
  breaths    integer not null,
  pace       text,
  retentions integer[] not null default '{}',   -- per-round hold seconds
  best_s     integer not null default 0,
  total_s    integer not null default 0,        -- total session seconds (approx)
  created_at timestamptz not null default now()
);
create index if not exists breath_sessions_user
  on public.breath_sessions (user_id, created_at desc);

alter table public.breath_sessions enable row level security;
drop policy if exists breath_sessions_select_own on public.breath_sessions;
create policy breath_sessions_select_own on public.breath_sessions
  for select using (user_id = auth.uid());
drop policy if exists breath_sessions_insert_own on public.breath_sessions;
create policy breath_sessions_insert_own on public.breath_sessions
  for insert with check (user_id = auth.uid());
grant select, insert on public.breath_sessions to authenticated;
