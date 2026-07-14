-- ============================================================================
-- Amazon Kinesis Video Streams (KVS) WebRTC cameras — sub-second, peer-to-peer
-- live CCTV viewed straight in the browser.
--
-- A local "master" (KVS WebRTC C SDK + GStreamer, running next to the camera)
-- pushes the RTSP feed into a KVS *signaling channel*. The website connects as
-- a *viewer* and receives the stream over WebRTC. We store only the channel
-- name + region here — both are non-secret; the AWS credentials that mint a
-- viewer session live server-side (env), never in a camera row or the browser.
-- ============================================================================

-- Add the new source type. (Adding an enum value is allowed inside the
-- migration transaction as long as it is not *used* in the same transaction —
-- we only reference it from application code, so this is safe.)
alter type public.camera_type add value if not exists 'kvs';

alter table public.user_cameras
  add column if not exists kvs_channel text
    check (kvs_channel is null or char_length(kvs_channel) between 1 and 256);

alter table public.user_cameras
  add column if not exists kvs_region text
    check (kvs_region is null or char_length(kvs_region) <= 40);

comment on column public.user_cameras.kvs_channel is
  'Amazon KVS signaling channel name for a kvs camera. Not secret — a viewer needs it; AWS credentials stay server-side.';
comment on column public.user_cameras.kvs_region is
  'AWS region of the KVS signaling channel (falls back to the server default).';
