-- ============================================================================
-- Share a camera with a group: every member of a group the camera is shared
-- with may watch its live feed (and open its /watch link). The owner still
-- controls which groups have access; the private rtsp_url is never exposed.
-- ============================================================================

create table public.camera_group_shares (
  camera_id uuid not null references public.user_cameras (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (camera_id, group_id)
);

create index camera_group_shares_group_idx
  on public.camera_group_shares (group_id);

alter table public.camera_group_shares enable row level security;

-- The camera's owner adds/removes group shares.
create policy "Camera owner manages group shares"
  on public.camera_group_shares
  for all
  using (
    exists (
      select 1 from public.user_cameras c
      where c.id = camera_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_cameras c
      where c.id = camera_id and c.owner_id = auth.uid()
    )
  );

-- Group members may read the share rows for their groups (to list cameras).
create policy "Group members read camera shares"
  on public.camera_group_shares
  for select
  using (public.is_group_member(group_id));

-- The gate that actually grants viewing: a member of a group the camera is
-- shared with may SELECT the camera row (viewer columns only; rtsp_url is never
-- selected by the app).
create policy "Group-shared cameras are viewable by members"
  on public.user_cameras
  for select
  using (
    exists (
      select 1 from public.camera_group_shares s
      where s.camera_id = user_cameras.id
        and public.is_group_member(s.group_id)
    )
  );
