-- WiGLE-style detail for the WiFi map.
--
-- The first cut stored only SSID/BSSID/security/signal, which answers "is
-- there wifi here" but not the questions an admin actually asks: which band
-- and channel is it on, which vendor's hardware is it, and what device was
-- doing the scanning. These are additive ALTERs — the tables already exist in
-- production — so they are safe to re-run.
--
-- Run on RDS, then: sudo docker restart postgrest

-- Radio detail on the deduplicated access-point row.
alter table public.wifi_networks
  add column if not exists frequency integer,      -- MHz, e.g. 2437
  add column if not exists channel integer,        -- derived, e.g. 6
  add column if not exists band text,              -- "2.4 GHz" / "5 GHz" / "6 GHz"
  add column if not exists capabilities text;      -- raw Android capability string

-- Channel-planning views ("what is congested here") need this index.
create index if not exists wifi_networks_channel_idx
  on public.wifi_networks (band, channel);

-- Per-scan radio detail + which client did the scanning. The client columns
-- live on the scan, not the AP: the same access point gets seen by many
-- different phones, and "which devices are contributing" is its own question.
alter table public.wifi_scans
  add column if not exists frequency integer,
  add column if not exists channel integer,
  add column if not exists band text,
  add column if not exists capabilities text,
  -- Raw UA for the web client; the app sends a short "Gwave-App/<build>".
  add column if not exists user_agent text,
  add column if not exists platform text,          -- android / ios / web
  add column if not exists os_version text,        -- "Android 14"
  add column if not exists device_model text,      -- "Pixel 7"
  add column if not exists app_build text;         -- CI run number

-- "Which devices/apps are contributing" — the client breakdown charts.
create index if not exists wifi_scans_platform_idx
  on public.wifi_scans (platform, scanned_at desc);

-- ---------------------------------------------------------------------------
-- Admin watchlist for networks worth keeping an eye on.
--
-- Border scam compounds ("pig butchering" operations) run large private
-- networks, and knowing where they are is genuinely useful — but a Wi-Fi scan
-- can never PROVE what a building is used for. So the judgement is human and
-- recorded: an admin flags a BSSID with a risk level and a note, and that flag
-- is what the dashboard shows. The clustering analysis in the UI is presented
-- as a lead to review, never as evidence, precisely because mislabelling a
-- legitimate business as a criminal operation is a real harm.
--
-- Server-only, like everything else here.
create table if not exists public.wifi_watchlist (
  bssid text primary key,
  -- watch = keep an eye on, suspect = looks organised/unusual,
  -- confirmed = corroborated from outside this map (reports, news, police).
  risk text not null default 'watch' check (risk in ('watch', 'suspect', 'confirmed', 'cleared')),
  -- What kind of concern: scam_compound, phishing_ap, unknown_cluster, other.
  category text not null default 'other',
  note text not null check (length(btrim(note)) >= 3),
  flagged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wifi_watchlist_risk_idx
  on public.wifi_watchlist (risk, updated_at desc);

alter table public.wifi_watchlist enable row level security;
-- Deliberately no policies: admin dashboard only, through the API route.
