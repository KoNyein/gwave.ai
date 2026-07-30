-- Per-user WiFi scan log.
--
-- wifi_networks is deduplicated by BSSID, so it can answer "where is this AP"
-- but not "who scanned what, when, and from where". This table is the raw
-- contribution log: one row per access point per scan, tagged with the user
-- and the GPS fix at that moment. It is what the admin dashboard reads to
-- show per-user contribution, coverage and activity over time.
--
-- RLS is enabled with ZERO policies, so PostgREST cannot see it at all — the
-- same "one gate, one place" pattern as metal_quotes. Only the server's admin
-- client (service role) writes and reads it, behind an admin role check.
--
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.wifi_scans (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  bssid text not null,
  ssid text,
  security text,
  signal integer,                       -- RSSI in dBm at scan time
  latitude double precision not null,   -- where the scanning phone was
  longitude double precision not null,
  scanned_at timestamptz not null default now()
);

-- Per-user history, newest first (the admin per-user drill-down).
create index if not exists wifi_scans_user_idx
  on public.wifi_scans (user_id, scanned_at desc);

-- Activity over time (the bar charts).
create index if not exists wifi_scans_time_idx
  on public.wifi_scans (scanned_at desc);

-- Coverage map / bounding-box queries.
create index if not exists wifi_scans_lat_lng_idx
  on public.wifi_scans (latitude, longitude);

-- One AP's full observation history across users.
create index if not exists wifi_scans_bssid_idx
  on public.wifi_scans (bssid, scanned_at desc);

alter table public.wifi_scans enable row level security;
-- Deliberately no policies: invisible to PostgREST, server-only.
