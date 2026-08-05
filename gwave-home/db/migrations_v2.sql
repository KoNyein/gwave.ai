-- ============================================================
-- GWAVE HOME PLATFORM - Migrations v2 (Smart System Engine)
-- Run after migrations.sql:
--   psql -h RDS_HOST -U gwave -d gwave -f migrations_v2.sql
-- ============================================================

-- ၁။ SENSOR READINGS — time-series data (charts + history)
CREATE TABLE IF NOT EXISTS sensor_readings (
  time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id TEXT NOT NULL,
  trait     TEXT NOT NULL,                 -- 'sensor.soil_moisture'
  value     DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_dev_trait_time
  ON sensor_readings (device_id, trait, time DESC);

-- TimescaleDB ရှိရင် (RDS: CREATE EXTENSION timescaledb) ဒီ ၂ ကြောင်းဖွင့်ပါ:
-- SELECT create_hypertable('sensor_readings','time', if_not_exists => TRUE);
-- SELECT add_retention_policy('sensor_readings', INTERVAL '365 days');

-- ၂။ RULES — automation (if-then)
CREATE TABLE IF NOT EXISTS gh_rules (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL REFERENCES gh_sites(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  enabled    BOOLEAN DEFAULT true,
  definition JSONB NOT NULL,
  -- definition format:
  -- { "trigger": {"type":"state","device":"...","trait":"...","condition":"lt|gt|eq|neq","value":30}
  --   OR         {"type":"schedule","at":"06:00","days":[1..7]}   (1=တနင်္လာ)
  --   "conditions": [{"type":"time_between","from":"06:00","to":"18:00"}],
  --   "actions": [
  --      {"type":"device","device":"...","command":"setOn","params":{"on":true}},
  --      {"type":"delay","seconds":600},
  --      {"type":"notify","message":"..."} ],
  --   "cooldown_seconds": 3600 }
  last_fired TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rules_site ON gh_rules(site_id);

-- ၃။ DEVICE CREDENTIALS — ကိုယ်ပိုင် MQTT hardware (ESP32) provisioning
CREATE TABLE IF NOT EXISTS gh_device_credentials (
  device_id          TEXT PRIMARY KEY REFERENCES gh_devices(id) ON DELETE CASCADE,
  mqtt_username      TEXT UNIQUE NOT NULL,
  mqtt_password_hash TEXT NOT NULL,        -- sha256
  issued_at          TIMESTAMPTZ DEFAULT now()
);

-- ၄။ NOTIFICATIONS
CREATE TABLE IF NOT EXISTS gh_notify_targets (
  user_id   UUID NOT NULL,
  fcm_token TEXT NOT NULL,
  PRIMARY KEY (user_id, fcm_token)
);

CREATE TABLE IF NOT EXISTS gh_notifications (
  id         BIGSERIAL PRIMARY KEY,
  site_id    TEXT REFERENCES gh_sites(id) ON DELETE CASCADE,
  device_id  TEXT,                         -- nullable (rule-level notify)
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_site_time ON gh_notifications(site_id, created_at DESC);
