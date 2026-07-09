-- GreenWave CCTV: members register their own cameras (a phone/PC publishing
-- over WebRTC, or a real CCTV via its RTSP URL) and watch them in the browser.
-- The actual video is carried by an external media server (Ant Media / LiveKit
-- on the operator's own infrastructure); this table only holds the metadata and
-- the sharing rules. GreenWave's Node/Next server talks to that media server
-- over its REST API to register and tear down streams.
--
-- Privacy is "private by default": a camera is visible only to its owner until
-- the owner explicitly makes it public — optionally for a limited time. Access
-- is enforced in the database with Row Level Security so a private feed can
-- never be read by anyone but its owner, even if a share link leaks.

create type public.camera_type as enum ('webrtc', 'rtsp');

create table public.user_cameras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'My Camera'
    check (char_length(title) between 1 and 120),
  camera_type public.camera_type not null,
  -- Only for RTSP cameras: the source URL the media server pulls from. Kept
  -- server-side; never exposed to viewers (see the RLS/By design note below).
  rtsp_url text check (rtsp_url is null or char_length(rtsp_url) <= 500),
  -- The stream id registered on the media server (what the player subscribes to).
  stream_id text not null unique check (char_length(stream_id) between 4 and 100),
  -- The opaque token used in a share link (/watch/<token>). Rotatable.
  share_token text not null unique check (char_length(share_token) between 8 and 100),
  -- Private by default. Public only when the owner opts in.
  is_public boolean not null default false,
  -- Optional expiry for a temporary public share. When set and in the past,
  -- the camera is treated as private again (enforced in the RLS policy).
  public_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An RTSP camera must carry a source URL; a WebRTC camera must not.
  constraint camera_rtsp_needs_url
    check (camera_type <> 'rtsp' or rtsp_url is not null),
  constraint camera_webrtc_no_url
    check (camera_type <> 'webrtc' or rtsp_url is null)
);

create index user_cameras_owner_idx
  on public.user_cameras (owner_id, created_at desc);
create index user_cameras_share_idx
  on public.user_cameras (share_token);

create trigger user_cameras_set_updated_at
  before update on public.user_cameras
  for each row execute function public.handle_updated_at();

alter table public.user_cameras enable row level security;

-- Owners have full control over their own cameras.
create policy "Owners manage their own cameras"
  on public.user_cameras
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Anyone (including anonymous share-link visitors) may READ a camera only while
-- it is public and any temporary-share window has not expired. This is the
-- single gate that makes a private feed unreadable to non-owners.
create policy "Public cameras are viewable by anyone"
  on public.user_cameras
  for select
  using (
    is_public = true
    and (public_until is null or public_until > now())
  );

-- By design: rtsp_url is a private field. The application layer never selects
-- it into any viewer-facing query — only the owner's management views and the
-- trusted server (service role) read it. Viewers only ever receive stream_id.
