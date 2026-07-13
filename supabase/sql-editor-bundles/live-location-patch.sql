-- ================================================================
-- Messenger — live location sharing patch
-- Copy into the Supabase SQL Editor and click "Run" (idempotent).
-- ================================================================

-- Messenger: live location sharing.
--
-- A one-off pin is already just latitude/longitude on the message. A *live*
-- share is a pin that keeps moving for a while, so the moving part needs a row
-- of its own that the sender overwrites and the recipients watch over Realtime.
-- The message row still carries the starting point (so the bubble renders
-- instantly, and still says something sensible once the share is over) plus
-- live_until, which is what tells the client to render the live map at all.

alter table public.messages
  add column if not exists live_until timestamptz;

create table if not exists public.live_locations (
  -- One live share per message; deleting the message ends the share.
  message_id uuid primary key
    references public.messages (id) on delete cascade,
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null
    check (longitude >= -180 and longitude <= 180),
  accuracy double precision,
  -- When the share lapses on its own, and when the sender ended it early.
  expires_at timestamptz not null,
  stopped_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists live_locations_conversation_idx
  on public.live_locations (conversation_id);

alter table public.live_locations enable row level security;

-- Anyone in the conversation can follow the pin.
drop policy if exists "Participants can view live locations" on public.live_locations;
create policy "Participants can view live locations"
  on public.live_locations
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

-- You can only share your own position, and only into a conversation you're in.
drop policy if exists "Participants can share their live location" on public.live_locations;
create policy "Participants can share their live location"
  on public.live_locations
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

-- Only the sharer moves their own pin (or stops it).
drop policy if exists "Sharers can update their live location" on public.live_locations;
create policy "Sharers can update their live location"
  on public.live_locations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Recipients see the pin move through Realtime UPDATE events.
do $$
begin
  alter publication supabase_realtime add table public.live_locations;
exception
  when duplicate_object then null;
end $$;
