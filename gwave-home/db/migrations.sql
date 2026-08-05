-- ============================================================
-- GWAVE HOME PLATFORM - Database Schema (RDS Postgres)
-- Run: psql -h RDS_HOST -U gwave -d gwave -f migrations.sql
-- ============================================================

-- ၁။ SITES — နေရာတစ်ခု (ခြံ၊ ဆိုင်၊ အိမ်) = Google Home ရဲ့ "Home" နဲ့တူတယ်
CREATE TABLE IF NOT EXISTS gh_sites (
  id          TEXT PRIMARY KEY,            -- 'farm01'
  owner_id    UUID NOT NULL,               -- gwave user (Cognito sub)
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ၂။ LINKED ACCOUNTS — user ↔ brand cloud account ချိတ်ဆက်မှု
--    (Google Home ရဲ့ "Works with Google Home" account linking နဲ့တူတယ်)
CREATE TABLE IF NOT EXISTS gh_linked_accounts (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL,
  connector     TEXT NOT NULL,             -- 'tuya' | 'imou' | 'ezviz'
  access_token  TEXT,                      -- production: KMS နဲ့ encrypt
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  meta          JSONB DEFAULT '{}',        -- brand uid စတာတွေ
  UNIQUE (user_id, connector)
);

-- ၃။ DEVICES — Unified Device Registry (platform ရဲ့ နှလုံးသည်း)
--    brand ဘယ်လိုကွဲကွဲ ဒီ table တစ်ခုတည်းထဲ တစ်ပုံစံတည်းဝင်တယ်
CREATE TABLE IF NOT EXISTS gh_devices (
  id            TEXT PRIMARY KEY,          -- 'dev_farm01_gate'
  site_id       TEXT NOT NULL REFERENCES gh_sites(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL,
  name          TEXT NOT NULL,             -- 'ဂိတ်ပေါက်ကင်မရာ'
  type          TEXT NOT NULL DEFAULT 'camera',
  connector     TEXT NOT NULL,             -- 'onvif' | 'tuya' | 'imou'
  connector_ref JSONB NOT NULL,            -- connector-specific id များ
                                           -- onvif: {"streamPath":"cam_farm01_gate"}
                                           -- tuya:  {"deviceId":"6cxxxx"}
  traits        JSONB NOT NULL DEFAULT '{}',
  is_online     BOOLEAN DEFAULT false,
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_site  ON gh_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON gh_devices(owner_id);

-- ၄။ SHARES — device sharing (မိသားစု/ဝန်ထမ်းကို ကြည့်ခွင့်ပေး)
CREATE TABLE IF NOT EXISTS gh_device_shares (
  device_id  TEXT REFERENCES gh_devices(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL DEFAULT 'viewer',   -- 'viewer' | 'controller'
  PRIMARY KEY (device_id, user_id)
);

-- ၅။ EVENTS — motion detection, offline alerts (notification pipeline အတွက်)
CREATE TABLE IF NOT EXISTS gh_events (
  id         BIGSERIAL PRIMARY KEY,
  device_id  TEXT REFERENCES gh_devices(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                -- 'motion' | 'offline' | 'online'
  payload    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_device_time ON gh_events(device_id, created_at DESC);
