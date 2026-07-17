-- Push-to-talk (walkie-talkie) channels. Members hold a button to record a
-- short voice message; it uploads and everyone else on the channel hears it —
-- realtime while online, and it stays in the channel history to catch up on.
-- Built for coordination during emergencies and field work.
--
-- Idempotent: safe to re-run (no migration ledger — files are piped into psql).

create table if not exists public.ptt_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ptt_channel_members (
  channel_id uuid not null references public.ptt_channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.ptt_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.ptt_channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  audio_path text not null,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists ptt_messages_channel_idx
  on public.ptt_messages (channel_id, created_at desc);

-- Membership check as SECURITY DEFINER to avoid RLS recursion between the
-- channel and membership tables (mirrors is_group_member).
create or replace function public.is_ptt_member(p_channel uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.ptt_channel_members
    where channel_id = p_channel and user_id = auth.uid()
  );
$$;

alter table public.ptt_channels enable row level security;
alter table public.ptt_channel_members enable row level security;
alter table public.ptt_messages enable row level security;

-- Channels: owner + members can read; anyone may create their own.
drop policy if exists "PTT channels readable by owner and members" on public.ptt_channels;
create policy "PTT channels readable by owner and members"
  on public.ptt_channels for select to authenticated
  using (owner_id = auth.uid() or public.is_ptt_member(id));

drop policy if exists "Users create their own PTT channel" on public.ptt_channels;
create policy "Users create their own PTT channel"
  on public.ptt_channels for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owner manages their PTT channel" on public.ptt_channels;
create policy "Owner manages their PTT channel"
  on public.ptt_channels for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owner deletes their PTT channel" on public.ptt_channels;
create policy "Owner deletes their PTT channel"
  on public.ptt_channels for delete to authenticated
  using (owner_id = auth.uid());

-- Membership: you see your own rows + fellow members; you add/remove yourself.
drop policy if exists "PTT membership visible to members" on public.ptt_channel_members;
create policy "PTT membership visible to members"
  on public.ptt_channel_members for select to authenticated
  using (user_id = auth.uid() or public.is_ptt_member(channel_id));

drop policy if exists "Users join PTT channels themselves" on public.ptt_channel_members;
create policy "Users join PTT channels themselves"
  on public.ptt_channel_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users leave PTT channels themselves" on public.ptt_channel_members;
create policy "Users leave PTT channels themselves"
  on public.ptt_channel_members for delete to authenticated
  using (user_id = auth.uid());

-- Messages: members read; members post as themselves.
drop policy if exists "PTT messages readable by members" on public.ptt_messages;
create policy "PTT messages readable by members"
  on public.ptt_messages for select to authenticated
  using (public.is_ptt_member(channel_id));

drop policy if exists "Members post PTT messages" on public.ptt_messages;
create policy "Members post PTT messages"
  on public.ptt_messages for insert to authenticated
  with check (public.is_ptt_member(channel_id) and user_id = auth.uid());
