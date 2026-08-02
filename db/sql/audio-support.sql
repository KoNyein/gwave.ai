-- Support tickets (Help Center). The app records the ticket here (system of
-- record) and fires an n8n webhook for triage/automation. Owner-only RLS: a
-- user sees and files only their own tickets. Apply on EC2 + restart postgrest.

create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  area       text not null default 'audio',
  category   text not null,                    -- purchase | playback | refund | other
  subject    text,
  message    text not null,
  track_id   uuid references public.audio_tracks(id) on delete set null,
  status     text not null default 'open'
               check (status in ('open','triage','resolved','closed')),
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user
  on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select using (user_id = auth.uid());
drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own on public.support_tickets
  for insert with check (user_id = auth.uid());
grant select, insert on public.support_tickets to authenticated;
