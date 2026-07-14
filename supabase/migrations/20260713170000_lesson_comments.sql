-- Lesson comments: let learners discuss below each lesson so learning is
-- interactive and engaging. Lessons are static content keyed by (track slug,
-- lesson slug) — not DB rows — so comments reference those slugs directly.

create table public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  track_slug text not null check (char_length(track_slug) between 1 and 120),
  lesson_slug text not null check (char_length(lesson_slug) between 1 and 120),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Fast lookup of a lesson's thread, newest first.
create index lesson_comments_lesson_idx
  on public.lesson_comments (track_slug, lesson_slug, created_at desc);

alter table public.lesson_comments enable row level security;

-- Any signed-in learner can read the discussion.
create policy "Signed-in users read lesson comments"
  on public.lesson_comments
  for select
  to authenticated
  using (true);

-- A user posts only as themselves.
create policy "Author inserts own lesson comment"
  on public.lesson_comments
  for insert
  to authenticated
  with check (author_id = auth.uid());

-- The author (or an admin, for moderation) can delete a comment.
create policy "Author or admin deletes lesson comment"
  on public.lesson_comments
  for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());
