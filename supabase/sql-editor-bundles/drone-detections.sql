-- Networked drone detections: a shared, time-limited feed of drones seen by
-- external RF sensors (SDR receivers — RTL-SDR / HackRF running OpenDroneID or
-- a DJI DroneID decoder, or a dedicated counter-UAS RF detector) and by phones.
-- The app reads recent detections near the user and plots them on the radar/map,
-- so an SDR on the server can pick up OcuSync / ELRS / Crossfire signals a phone
-- cannot, and every client sees them.
--
-- Run on EC2 (dockerised psql), then: sudo docker restart postgrest
--
-- Sensors POST to /api/drone/report with the x-sensor-key header
-- (env DRONE_SENSOR_KEY). Only the service role inserts (via that API); there is
-- no RLS insert policy, so untrusted clients cannot write. Authenticated users
-- may read non-expired rows.

create table if not exists public.drone_detections (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'sensor',   -- sensor | sdr | remoteid | wifi | ble
  sensor_id    text,                              -- which sensor reported it
  protocol     text,                              -- OcuSync | ELRS | Crossfire | Remote ID | Wi-Fi …
  vendor       text,
  label        text,
  rssi         integer,
  lat          double precision,
  lng          double precision,
  altitude_m   double precision,
  heading_deg  double precision,
  speed_ms     double precision,
  remote_id    text,                              -- operator / serial when known
  detected_at  timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '5 minutes'),
  created_at   timestamptz not null default now()
);

create index if not exists drone_detections_live
  on public.drone_detections (expires_at, detected_at desc);
create index if not exists drone_detections_geo
  on public.drone_detections (lat, lng);

alter table public.drone_detections enable row level security;

-- Signed-in users can read the live feed (non-expired rows). No insert/update
-- policy: only the service role (via the ingest API) writes.
drop policy if exists drone_detections_read on public.drone_detections;
create policy drone_detections_read on public.drone_detections
  for select using (expires_at > now());

grant select on public.drone_detections to authenticated;

-- Housekeeping: an index-friendly way to purge old rows. Call periodically
-- (cron / pg_cron) or rely on the API filtering by expires_at.
-- delete from public.drone_detections where expires_at < now() - interval '1 hour';
