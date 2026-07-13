-- Multi-guest co-host Live — a public, discoverable version of the WebRTC grid
-- room. A host opens a room; other members join the video grid to co-host and
-- anyone can watch. Just a directory row per room; the video itself runs over
-- the existing mesh WebRTC signalling (Supabase realtime).

create table public.cohost_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 3 and 40),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index cohost_rooms_live_idx
  on public.cohost_rooms (created_at desc) where ended_at is null;

alter table public.cohost_rooms enable row level security;

-- Anyone signed in can browse rooms; the directory query filters to live ones.
create policy "Read cohost rooms"
  on public.cohost_rooms
  for select
  to authenticated
  using (true);

-- Open a room as yourself (not while suspended).
create policy "Host opens cohost room"
  on public.cohost_rooms
  for insert
  to authenticated
  with check (host_id = auth.uid() and not public.is_suspended(auth.uid()));

-- The host (or an admin) ends / edits their room.
create policy "Host ends cohost room"
  on public.cohost_rooms
  for update
  to authenticated
  using (host_id = auth.uid() or public.is_admin())
  with check (host_id = auth.uid() or public.is_admin());
