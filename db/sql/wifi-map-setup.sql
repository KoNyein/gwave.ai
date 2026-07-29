-- Crowdsourced WiFi map (WiGLE-style). Each row is one access point (by BSSID)
-- with the best-signal location any user has observed. Written server-side via
-- the admin client; publicly readable so everyone shares the collected map.
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.wifi_networks (
  bssid text primary key,                       -- AP MAC address (unique)
  ssid text,                                     -- network name (may be hidden)
  security text,                                 -- OPEN / WPA2 / WPA3 / ...
  best_signal integer,                           -- strongest RSSI seen (dBm)
  latitude double precision not null,
  longitude double precision not null,
  observations integer not null default 1,
  first_user uuid references public.profiles(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Fast bounding-box lookups for the map viewport.
create index if not exists wifi_networks_lat_lng_idx
  on public.wifi_networks (latitude, longitude);

alter table public.wifi_networks enable row level security;

-- Public read (the shared map); all writes go through the server admin client.
drop policy if exists wifi_networks_public_read on public.wifi_networks;
create policy wifi_networks_public_read
  on public.wifi_networks for select using (true);
