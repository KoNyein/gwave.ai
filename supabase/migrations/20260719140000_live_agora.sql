-- Agora Live provider (feature-flagged alongside LiveKit/Mux). A stream is an
-- Agora stream when agora_channel is set. Cloud Recording handles are kept so we
-- can stop the recording when the broadcast ends; the finished MP4's object key
-- lands in the existing recording_path column (added by the live_recording
-- migration), and the ended watch page replays it.
--
-- Idempotent: safe to re-run (files are piped straight into psql, no ledger).

alter table public.live_streams
  add column if not exists agora_channel text,
  add column if not exists agora_resource_id text,
  add column if not exists agora_recording_sid text;
