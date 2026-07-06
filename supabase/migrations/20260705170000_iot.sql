-- Phase 6: IoT — smart farm sensors and smart home devices. Devices publish
-- over MQTT to the bridge service (services/iot-bridge), which writes
-- telemetry here with the service role; the web app reads via RLS.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.device_type as enum (
  'sensor',
  'switch',
  'camera',
  'controller'
);

create type public.device_protocol as enum ('mqtt', 'http');

create type public.alert_severity as enum ('info', 'warning', 'critical');

create type public.command_status as enum ('pending', 'sent', 'acked', 'failed');

-- Device alerts surface as notifications.
alter type public.notification_type add value if not exists 'device_alert';

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type public.device_type not null,
  protocol public.device_protocol not null default 'mqtt',
  zone text not null default 'default',
  -- MQTT base topic: the device publishes <topic>/telemetry and
  -- <topic>/state, and listens on <topic>/cmd.
  topic text not null unique,
  -- Per-device credential the bridge checks on telemetry (demo-grade;
  -- production should use broker-level auth/TLS as well).
  secret text not null,
  config jsonb not null default '{}',
  state jsonb not null default '{}',
  online boolean not null default false,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devices_owner_idx on public.devices (owner_id, type);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Telemetry (high-volume, append-only; BRIN keeps the time index tiny)
-- ---------------------------------------------------------------------------

create table public.sensor_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  metric text not null,
  value numeric(12, 3) not null,
  ts timestamptz not null default now()
);

create index sensor_readings_ts_brin on public.sensor_readings using brin (ts);
create index sensor_readings_device_metric_idx
  on public.sensor_readings (device_id, metric, ts desc);

-- ---------------------------------------------------------------------------
-- Automation rules, alerts, scenes, schedules, commands
-- ---------------------------------------------------------------------------

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- IF <trigger_device>.<metric> <comparator> <threshold>
  trigger_device_id uuid not null references public.devices (id) on delete cascade,
  metric text not null,
  comparator text not null check (comparator in ('gt', 'gte', 'lt', 'lte')),
  threshold numeric(12, 3) not null,
  -- THEN send <action> to <action_device> (null = alert only)
  action_device_id uuid references public.devices (id) on delete set null,
  action jsonb not null default '{}',
  -- Optional active window (evaluated in the bridge's local time).
  time_start time,
  time_end time,
  severity public.alert_severity not null default 'warning',
  cooldown_minutes integer not null default 15
    check (cooldown_minutes between 1 and 1440),
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_rules_trigger_idx
  on public.automation_rules (trigger_device_id, metric)
  where enabled;

create trigger automation_rules_set_updated_at
  before update on public.automation_rules
  for each row execute function public.handle_updated_at();

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid references public.devices (id) on delete cascade,
  rule_id uuid references public.automation_rules (id) on delete set null,
  severity public.alert_severity not null default 'warning',
  message text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index alerts_owner_idx on public.alerts (owner_id, created_at desc);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- [{ "device_id": "...", "command": { "power": "on" } }, ...]
  actions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.scene_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  scene_id uuid not null references public.scenes (id) on delete cascade,
  run_at time not null,
  -- ISO weekday numbers, 1 = Monday … 7 = Sunday.
  days_of_week integer[] not null default '{1,2,3,4,5,6,7}',
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

-- Command queue: the web app inserts, the bridge picks up (realtime) and
-- publishes to MQTT, then marks sent/acked.
create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  issued_by uuid references public.profiles (id) on delete set null,
  command jsonb not null,
  status public.command_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_commands_pending_idx
  on public.device_commands (created_at)
  where status = 'pending';

create trigger device_commands_set_updated_at
  before update on public.device_commands
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Alert → in-app notification (SECURITY DEFINER, like other notifiers)
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.owner_id, null, 'device_alert');
  return null;
end;
$$;

create trigger alerts_notify
  after insert on public.alerts
  for each row execute function public.notify_on_alert();

-- ---------------------------------------------------------------------------
-- Latest reading per device+metric for the dashboard (RLS applies: invoker)
-- ---------------------------------------------------------------------------

create or replace function public.latest_sensor_readings()
returns table (
  device_id uuid,
  metric text,
  value numeric,
  ts timestamptz
)
language sql
stable
security invoker
as $$
  select distinct on (r.device_id, r.metric)
    r.device_id, r.metric, r.value, r.ts
  from public.sensor_readings r
  order by r.device_id, r.metric, r.ts desc;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: live dashboard + command dispatch + state echo
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.sensor_readings;
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.device_commands;
alter publication supabase_realtime add table public.alerts;

-- ---------------------------------------------------------------------------
-- Row Level Security — everything is owner-scoped; telemetry inserts and
-- command status transitions happen in the bridge via the service role.
-- ---------------------------------------------------------------------------

alter table public.devices enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.automation_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_schedules enable row level security;
alter table public.device_commands enable row level security;

create policy "Owners manage their devices"
  on public.devices
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners read their sensor readings"
  on public.sensor_readings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
  );

create policy "Owners manage their automation rules"
  on public.automation_rules
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.devices d
      where d.id = trigger_device_id and d.owner_id = auth.uid()
    )
    and (
      action_device_id is null
      or exists (
        select 1 from public.devices d
        where d.id = action_device_id and d.owner_id = auth.uid()
      )
    )
  );

create policy "Owners read their alerts"
  on public.alerts
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Owners can acknowledge their alerts"
  on public.alerts
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage their scenes"
  on public.scenes
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage their schedules"
  on public.scene_schedules
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.scenes s
      where s.id = scene_id and s.owner_id = auth.uid()
    )
  );

create policy "Owners see commands for their devices"
  on public.device_commands
  for select
  to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
  );

create policy "Owners can queue commands for their devices"
  on public.device_commands
  for insert
  to authenticated
  with check (
    issued_by = auth.uid()
    and exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
  );
