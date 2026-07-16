-- ============================================================================
-- CCTV: camera zones (grouping) + PTZ control endpoint.
--   * zone    — a free-text room/area label ("Gate", "Kitchen", "Greenhouse")
--               so cameras group on the list and the live wall. Not secret.
--   * ptz_url — an optional operator-provided HTTP endpoint that moves a
--               pan/tilt/zoom camera. May carry a camera credential, so it is
--               server-side only (never selected into a public/viewer row),
--               exactly like rtsp_url.
-- ============================================================================

alter table public.user_cameras
  add column if not exists zone text
    check (zone is null or char_length(zone) <= 60);

alter table public.user_cameras
  add column if not exists ptz_url text
    check (ptz_url is null or char_length(ptz_url) <= 500);

comment on column public.user_cameras.ptz_url is
  'Optional HTTP PTZ control endpoint. Server-side only (may carry a camera credential) — never sent to a viewer, like rtsp_url.';
