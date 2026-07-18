-- Amazon IVS Low-Latency provider (AWS-native Live). A stream is an IVS stream
-- when ivs_channel_arn is set: the host pushes RTMPS from OBS (stream key kept
-- host-only in live_stream_keys, same as Mux), viewers watch ivs_playback_url
-- (HLS). ivs_ingest_url is the RTMPS endpoint shown to the host.
--
-- Idempotent: safe to re-run (files are piped straight into psql, no ledger).

alter table public.live_streams
  add column if not exists ivs_channel_arn text,
  add column if not exists ivs_ingest_url text,
  add column if not exists ivs_playback_url text;
