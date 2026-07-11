-- Fix two RLS bugs that broke posting entirely:
--
-- 1. INSERT ... RETURNING on posts was rejected. The SELECT policy is
--    can_view_post_id(id), which re-queries public.posts for the row — but
--    during the INSERT's own RETURNING check the just-inserted row is not
--    yet visible to that subquery's snapshot, so the policy evaluated false
--    and every createPost (.select("id")) failed with "new row violates
--    row-level security policy". Prefix the policy with a direct
--    author_id = auth.uid() check, which is evaluated on the candidate row
--    itself (no subquery), so authors always see their own posts.
--
-- 2. Sharing a post always failed. Inside the INSERT policy's EXISTS
--    subquery the unqualified shared_post_id resolved to the subquery's
--    own table (original.shared_post_id), not the new row's column, making
--    the condition self-contradictory. Qualify the outer reference as
--    posts.shared_post_id.

drop policy if exists "Posts are viewable according to visibility"
  on public.posts;
create policy "Posts are viewable according to visibility"
  on public.posts
  for select
  to authenticated
  using (author_id = auth.uid() or public.can_view_post_id(id));

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
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
