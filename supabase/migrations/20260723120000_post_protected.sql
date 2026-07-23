-- Photo-protection: let a poster forbid screenshots / saving of a post's
-- photos. The mobile viewer reads posts.protected and, when true, raises the
-- Android FLAG_SECURE window flag (blocking screenshots + screen recording)
-- and hides every share/save affordance.
--
-- No RLS change is needed: the SELECT policy on public.posts is row-level
-- ("author_id = auth.uid() or public.can_view_post_id(id)") and does not
-- restrict columns, so the new column is exposed automatically to the app's
-- select("*"). The INSERT policy likewise does not restrict columns, so an
-- author may set protected on their own post.
--
-- The column is also added to public.post_media (media lives in a separate
-- table) so the protection intent is recorded alongside each stored file, even
-- though the app currently enforces at the post level. It defaults to false and
-- is harmless where unused.

alter table public.posts
  add column if not exists protected boolean not null default false;

alter table public.post_media
  add column if not exists protected boolean not null default false;

comment on column public.posts.protected is
  'When true, posters forbid screenshots/saving; the app raises FLAG_SECURE in the viewer and hides share/save. Web enforcement is a follow-up (a browser screenshot cannot be blocked; the flag lets web hide the download button).';
