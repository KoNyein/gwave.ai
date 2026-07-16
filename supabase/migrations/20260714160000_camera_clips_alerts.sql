-- ============================================================================
-- CCTV recording: saved clips + motion/face alerts.
--   * camera_clips  — a short recording captured in the browser (manual, or
--     auto-triggered by motion/face), stored in the "media" bucket.
--   * camera_alerts — a motion or face event, optionally linked to a clip, so
--     the owner has a reviewable event log (with an unseen count).
-- Both are strictly owner-only (RLS): a camera's recordings and events are
-- private to whoever owns the camera.
-- ============================================================================

create table public.camera_clips (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.user_cameras (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 500),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  kind text not null default 'manual'
    check (kind in ('manual', 'motion', 'face')),
  created_at timestamptz not null default now()
);

create index camera_clips_camera_idx
  on public.camera_clips (camera_id, created_at desc);

alter table public.camera_clips enable row level security;

create policy "Owner manages own camera clips"
  on public.camera_clips
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table public.camera_alerts (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.user_cameras (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('motion', 'face')),
  clip_id uuid references public.camera_clips (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

create index camera_alerts_owner_idx
  on public.camera_alerts (owner_id, created_at desc);
create index camera_alerts_unseen_idx
  on public.camera_alerts (owner_id) where not seen;

alter table public.camera_alerts enable row level security;

create policy "Owner manages own camera alerts"
  on public.camera_alerts
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
