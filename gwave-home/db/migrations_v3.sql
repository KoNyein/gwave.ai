-- ============================================================
-- Migrations v3 — rename the platform's time-series table.
-- The web app's OLDER /home smart-home feature already owns a
-- "sensor_readings" table with a different shape, so the platform's
-- table is namespaced gh_* like every other platform table. Safe to
-- run repeatedly; run after migrations.sql + migrations_v2.sql.
-- ============================================================
CREATE TABLE IF NOT EXISTS gh_sensor_readings (
  time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id TEXT NOT NULL,
  trait     TEXT NOT NULL,
  value     DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gh_readings_dev_trait_time
  ON gh_sensor_readings (device_id, trait, time DESC);
