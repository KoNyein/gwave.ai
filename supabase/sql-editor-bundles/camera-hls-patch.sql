-- ================================================================
-- GreenWave CCTV — HLS live playback patch
-- Copy this whole file into the Supabase SQL Editor and click "Run".
-- Safe to run more than once (idempotent).
-- ================================================================

-- Add the public HLS (.m3u8) playback URL column.
-- This holds a CREDENTIAL-FREE playback link served by your media server
-- (MediaMTX / Ant Media / nginx). Your private RTSP address (with password)
-- stays in the existing rtsp_url column and is NEVER exposed to the browser.
alter table public.user_cameras
  add column if not exists hls_url text
    check (hls_url is null or char_length(hls_url) <= 500);

comment on column public.user_cameras.hls_url is
  'Public HLS (.m3u8) playback URL served by the media server. Contains no '
  'credentials; the private RTSP source stays in rtsp_url server-side only.';

-- No RLS change is needed: the existing policies already cover this column.
--   • "Owners manage their own cameras"  → the owner can set/read hls_url
--   • "Public cameras are viewable by anyone" → viewers can read hls_url only
--     while the camera is public (and any temporary-share window is open).
-- Because hls_url carries no password, exposing it to public viewers is safe.

-- Quick check (optional): confirm the column exists.
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'user_cameras'
--   and column_name = 'hls_url';
