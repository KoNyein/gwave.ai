-- Restore the post-INSERT guards that 20260711110000_fix_post_rls.sql
-- silently dropped.
--
-- That migration rewrote "Users can create their own posts" to fix the share
-- visibility check, but the rewrite kept ONLY the share condition — losing
-- three guards the 20260705190000_admin_dev version had:
--   * not is_suspended(auth.uid())       → suspended users could post again
--   * group_id is null or is_group_member → non-members could post into groups
--   * page_id owner check                → anyone could post as a page
--
-- Found by scripts/rls-audit.sql ("FAIL: suspended user posted") while
-- validating the camera-vendor migrations. This restores all three guards
-- and keeps fix_post_rls's share condition exactly as it shipped.

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_suspended(auth.uid())
    and (group_id is null or public.is_group_member(group_id))
    and (
      page_id is null
      or exists (
        select 1 from public.pages pg
        where pg.id = page_id and pg.owner_id = auth.uid()
      )
    )
    and (
      shared_post_id is null
      or exists (
        select 1
        from public.posts original
        where original.id = posts.shared_post_id
          and original.shared_post_id is null
          and public.can_view_post(original.author_id, original.visibility)
      )
    )
  );
