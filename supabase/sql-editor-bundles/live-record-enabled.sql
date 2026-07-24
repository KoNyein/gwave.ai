-- Opt-in live recording (international "record → replay" standard).
-- Adds a per-broadcast flag: only when the host turned Record on is the
-- broadcast recorded and exposed as a replay after it ends.
--
-- Existing rows are backfilled to true (they recorded under the old
-- always-on behaviour). Run this BEFORE deploying the record-toggle code,
-- then: sudo docker restart postgrest
alter table public.live_streams
  add column if not exists record_enabled boolean not null default true;
