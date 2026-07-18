-- Live replays: Mux already records every broadcast (streams are created with
-- new_asset_settings), but the recording's playback id was never captured, so
-- ended streams showed only a "broadcast has ended" placeholder. Store it here;
-- the Mux webhook fills it when the recording asset becomes ready.
--
-- Idempotent: safe to re-run (no migration ledger — files are piped into psql).

alter table public.live_streams
  add column if not exists vod_playback_id text;
