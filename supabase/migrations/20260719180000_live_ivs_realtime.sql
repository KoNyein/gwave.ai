-- Amazon IVS Real-Time (phone-browser Live). A stream is an IVS stage stream
-- when ivs_stage_arn is set; ivs_composition_arn tracks the in-flight composite
-- recording (stopped on end; the finished HLS master path lands in the existing
-- recording_path column).
--
-- Idempotent: safe to re-run (files are piped straight into psql, no ledger).

alter table public.live_streams
  add column if not exists ivs_stage_arn text,
  add column if not exists ivs_composition_arn text;
