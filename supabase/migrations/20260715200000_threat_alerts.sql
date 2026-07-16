-- Community early-warning ("air-raid") system. A person who spots an incoming
-- threat — a jet, shelling, a drone, troops, a disaster — reports it with a
-- location; everyone inside the threat's radius gets an instant high-priority
-- warning so they can take cover. This is a human spotter-relay network (the
-- app can't detect ordnance itself); it's how grassroots warning saves lives.

create type public.threat_kind as enum (
  'airstrike',  -- jet / aircraft / bombing
  'artillery',  -- shelling / heavy weapons
  'drone',
  'ground',     -- troops / ground assault
  'disaster',   -- flood, quake, storm
  'other'
);

create table public.threat_alerts (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  kind public.threat_kind not null default 'other',
  latitude double precision not null,
  longitude double precision not null,
  -- Direction the threat is coming from / heading, 0-360 (optional).
  heading double precision,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  -- Warnings auto-expire; airstrikes are brief, disasters can linger.
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create index threat_alerts_active_idx
  on public.threat_alerts (expires_at desc, created_at desc);

alter table public.threat_alerts enable row level security;

-- Any signed-in user sees active warnings (the whole point) and manages their
-- own reports.
create policy "Active threat warnings visible to all authenticated"
  on public.threat_alerts for select to authenticated
  using (expires_at > now() or reporter_id = auth.uid());

create policy "Users report threats themselves"
  on public.threat_alerts for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "Reporters manage their own threat reports"
  on public.threat_alerts for update to authenticated
  using (reporter_id = auth.uid())
  with check (reporter_id = auth.uid());
