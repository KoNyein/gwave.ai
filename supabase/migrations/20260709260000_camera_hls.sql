-- GreenWave CCTV — HLS live playback.
--
-- Adds an optional HLS playlist URL (an .m3u8) to each camera. This is the URL
-- a media server (MediaMTX, Ant Media, nginx-rtmp, …) publishes for browser
-- playback. The operator's server pulls the private RTSP feed (credentials and
-- all) internally and re-serves it as HLS; only this credential-free .m3u8 URL
-- ever reaches a browser. The private rtsp_url stays server-side, exactly as
-- before.
--
-- hls_url is safe for viewers to receive: it carries no password and is only
-- reachable while the camera is public (the existing RLS "Public cameras are
-- viewable by anyone" policy already gates every column, this one included).

alter table public.user_cameras
  add column if not exists hls_url text
    check (hls_url is null or char_length(hls_url) <= 500);

comment on column public.user_cameras.hls_url is
  'Public HLS (.m3u8) playback URL served by the media server. Contains no '
  'credentials; the private RTSP source stays in rtsp_url server-side only.';
