-- ============================================================================
-- Fix: "infinite recursion detected in policy for relation user_cameras" (42P17)
--
-- Every authenticated read of user_cameras / camera_group_shares was returning
-- 500 in production. The two tables' RLS policies referenced each other:
--
--   SELECT user_cameras
--     -> policy "Group-shared cameras are viewable by members"
--          subquery: FROM camera_group_shares      (RLS re-entered)
--     -> policy "Camera owner manages group shares" (FOR ALL => covers SELECT)
--          subquery: FROM user_cameras             (RLS re-entered)
--     -> ...loop.
--
-- The fix is the same trick that already makes is_group_member() safe: do the
-- cross-table lookup inside a SECURITY DEFINER function owned by the table
-- owner (gwaveadmin), so the inner read does not re-enter RLS. Both edges of
-- the cycle are cut, so re-adding a policy later cannot silently reintroduce it.
--
-- Semantics are preserved. Previously the inner subqueries were themselves
-- RLS-filtered, but in both cases the filtering was a no-op:
--   * owner check   -> "Owners manage their own cameras" already exposes the
--                      owner's own row, so bypassing RLS returns the same rows.
--   * share check   -> "Group members read camera shares" already exposes share
--                      rows for the viewer's groups, and is_group_member() is
--                      re-applied inside the function regardless.
-- ============================================================================

-- Owner check without re-entering user_cameras RLS.
create or replace function public.is_camera_owner(cam_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1 from public.user_cameras c
    where c.id = cam_id
      and c.owner_id = auth.uid()
  );
$fn$;

comment on function public.is_camera_owner(uuid) is
  'True if the current user owns the camera. SECURITY DEFINER so RLS policies on camera_group_shares can check ownership without recursing back into user_cameras RLS.';

-- Group-share check without re-entering camera_group_shares RLS.
create or replace function public.camera_shared_with_me(cam_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1 from public.camera_group_shares s
    where s.camera_id = cam_id
      and public.is_group_member(s.group_id)
  );
$fn$;

comment on function public.camera_shared_with_me(uuid) is
  'True if the camera is shared with a group the current user actively belongs to. SECURITY DEFINER so RLS policies on user_cameras can check shares without recursing back into camera_group_shares RLS.';

-- Cut edge B: camera_group_shares -> user_cameras
drop policy if exists "Camera owner manages group shares" on public.camera_group_shares;
create policy "Camera owner manages group shares"
  on public.camera_group_shares
  for all
  using (public.is_camera_owner(camera_id))
  with check (public.is_camera_owner(camera_id));

-- Cut edge A: user_cameras -> camera_group_shares
drop policy if exists "Group-shared cameras are viewable by members" on public.user_cameras;
create policy "Group-shared cameras are viewable by members"
  on public.user_cameras
  for select
  using (public.camera_shared_with_me(id));
