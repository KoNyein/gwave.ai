-- Facebook-Live-style streaming backed by Mux.
--   * live_streams — one row per broadcast; status driven by Mux webhooks.
--   * live_stream_keys — the RTMP stream key, in its OWN table so RLS can
--     make it host-only (column-level hiding on the main table would break
--     PostgREST star-selects; a separate table is the robust way to keep the
--     secret out of every public query path).
--   * live_chat_messages — realtime chat via postgres_changes.
--   * live_reactions — tap reactions (broadcast drives the animation; rows
--     are kept for counts/analytics).
-- Rows are created/updated by trusted server routes using the service role
-- (Mux IDs come from the Mux API), so client policies are read + chat/react
-- writes only.

create type public.live_stream_status as enum ('idle', 'live', 'ended');

-- ---------------------------------------------------------------------------
-- Streams
-- ---------------------------------------------------------------------------

create table public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  status public.live_stream_status not null default 'idle',
  mux_stream_id text not null unique,
  mux_playback_id text,
  viewer_count int not null default 0 check (viewer_count >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index live_streams_status_idx
  on public.live_streams (status, started_at desc);
create index live_streams_host_idx
  on public.live_streams (host_id, created_at desc);

alter table public.live_streams enable row level security;

-- Everyone signed in can browse streams (the key lives elsewhere).
create policy "Streams are viewable by authenticated users"
  on public.live_streams
  for select
  to authenticated
  using (true);

-- Hosts may edit their own title/description; status/Mux fields are managed
-- by the server (service role bypasses RLS).
create policy "Hosts can update their own streams"
  on public.live_streams
  for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "Hosts can delete their own streams"
  on public.live_streams
  for delete
  to authenticated
  using (host_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stream keys (host-only secret)
-- ---------------------------------------------------------------------------

create table public.live_stream_keys (
  stream_id uuid primary key references public.live_streams (id) on delete cascade,
  stream_key text not null
);

alter table public.live_stream_keys enable row level security;

-- Only the stream's host can ever read the key. Writes happen exclusively
-- through the service role in /api/live/create.
create policy "Hosts can read their own stream key"
  on public.live_stream_keys
  for select
  to authenticated
  using (
    exists (
      select 1 from public.live_streams s
      where s.id = stream_id and s.host_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create table public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index live_chat_stream_idx
  on public.live_chat_messages (stream_id, created_at);

alter table public.live_chat_messages enable row level security;

create policy "Chat is viewable by authenticated users"
  on public.live_chat_messages
  for select
  to authenticated
  using (true);

create policy "Users send chat as themselves"
  on public.live_chat_messages
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_suspended(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------

create table public.live_reactions (
  id bigint generated always as identity primary key,
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '👍', '😂', '😮', '👏', '🔥')),
  created_at timestamptz not null default now()
);

create index live_reactions_stream_idx
  on public.live_reactions (stream_id, created_at);

alter table public.live_reactions enable row level security;

create policy "Reactions are viewable by authenticated users"
  on public.live_reactions
  for select
  to authenticated
  using (true);

create policy "Users react as themselves"
  on public.live_reactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Chat arrives via postgres_changes; stream status flips (idle→live→ended)
-- also stream to viewers so the page updates without a refresh.
alter publication supabase_realtime add table public.live_chat_messages;
alter publication supabase_realtime add table public.live_streams;
