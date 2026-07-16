-- Emergency SOS system. A user in danger broadcasts their live location and
-- situation category; every signed-in user sees active alerts on the GPS map
-- and can mark themselves as responding. Built for disaster / conflict / medical
-- emergencies where fast, visible, location-anchored help matters.

create type public.sos_category as enum (
  'medical',    -- injury / illness
  'disaster',   -- flood, quake, storm, landslide
  'conflict',   -- armed conflict / shelling / unsafe area
  'fire',
  'trapped',    -- stuck / can't move
  'other'
);

create type public.sos_status as enum (
  'active',     -- still needs help
  'safe',       -- person marked themselves safe (kept visible briefly)
  'resolved',   -- help arrived / closed
  'cancelled'   -- raised by mistake
);

create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.sos_category not null default 'other',
  status public.sos_status not null default 'active',
  message text check (message is null or char_length(message) <= 500),
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index sos_alerts_open_idx
  on public.sos_alerts (status, created_at desc)
  where status in ('active', 'safe');
create index sos_alerts_user_idx on public.sos_alerts (user_id);

-- Who is coming to help, so the person in danger (and other helpers) can see
-- that aid is on the way and coordinate.
create table public.sos_responders (
  alert_id uuid not null references public.sos_alerts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

alter table public.sos_alerts enable row level security;
alter table public.sos_responders enable row level security;

-- Open alerts are visible to every authenticated user (that is the point — so
-- anyone nearby can help); a user always sees all of their own alerts.
create policy "Open SOS alerts are visible to all authenticated"
  on public.sos_alerts for select to authenticated
  using (status in ('active', 'safe') or user_id = auth.uid());

create policy "Users raise their own SOS"
  on public.sos_alerts for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users manage their own SOS"
  on public.sos_alerts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Responders are visible to the alert owner and to each responder.
create policy "SOS responders visible to owner and responders"
  on public.sos_responders for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sos_alerts a
      where a.id = alert_id and a.user_id = auth.uid()
    )
  );

create policy "Users respond to an SOS as themselves"
  on public.sos_responders for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users withdraw their own response"
  on public.sos_responders for delete to authenticated
  using (user_id = auth.uid());

create trigger sos_alerts_set_updated_at
  before update on public.sos_alerts
  for each row execute function public.handle_updated_at();
