-- SFU (LiveKit) support for co-host Live.
--
-- The mesh WebRTC grid tops out at a handful of peers. To scale a co-host Live
-- to thousands of viewers we route media through an SFU (LiveKit): a small set
-- of *publishers* (the host + approved co-hosts) send their camera/mic, and the
-- media server fans those streams out to everyone else, who only *subscribe*.
--
-- Publish permission is baked into each viewer's LiveKit access token, minted
-- server-side. This table is the durable allow-list of who may publish in a
-- room. The host is always allowed implicitly; everyone here was promoted by
-- the host ("raise hand" -> approve).

create table public.cohost_guests (
  room_id uuid not null references public.cohost_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index cohost_guests_room_idx on public.cohost_guests (room_id);

alter table public.cohost_guests enable row level security;

-- Anyone signed in can see who the co-hosts of a room are.
create policy "Read cohost guests"
  on public.cohost_guests
  for select
  to authenticated
  using (true);

-- Only the room's host may promote a guest to co-host (and must record it as
-- themselves). Suspended hosts cannot.
create policy "Host adds cohost guest"
  on public.cohost_guests
  for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and not public.is_suspended(auth.uid())
    and exists (
      select 1 from public.cohost_rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- The host (or an admin) can remove a co-host; a co-host can also step down.
create policy "Host or self removes cohost guest"
  on public.cohost_guests
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.cohost_rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );
