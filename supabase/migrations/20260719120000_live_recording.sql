-- Auto-save for LiveKit (browser) broadcasts. Mux streams already record to a
-- VOD (vod_playback_id); LiveKit rooms had no recording at all, so an ended
-- browser Live left only a "broadcast has ended" placeholder. When LiveKit
-- Egress is configured the server starts a room-composite recording the moment
-- the host goes live and stops it when the broadcast ends; the finished MP4's
-- object key lands in recording_path (filled by the egress_ended webhook), and
-- recording_egress_id tracks the in-flight egress so we can stop it.
--
-- Idempotent: safe to re-run (files are piped straight into psql, no ledger).

alter table public.live_streams
  add column if not exists recording_path text,
  add column if not exists recording_egress_id text;
