-- Learn platform: per-user lesson progress and saved projects.
--   * lesson_progress — one row per user+track+lesson; drives progress bars,
--     completion checkmarks and the "continue learning" resume point.
--   * member_projects — the learner's saved game/playground state (jsonb),
--     auto-saved by the client so work survives reloads and devices.
-- Both tables are strictly self-scoped by RLS: a user can only ever see and
-- write their own rows.

create type public.lesson_status as enum ('in_progress', 'completed');

-- ---------------------------------------------------------------------------
-- Lesson progress
-- ---------------------------------------------------------------------------

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_slug text not null check (char_length(track_slug) between 1 and 60),
  lesson_slug text not null check (char_length(lesson_slug) between 1 and 60),
  status public.lesson_status not null default 'in_progress',
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  -- Quiz/game score as a percentage, when the lesson produces one.
  score int check (score is null or (score between 0 and 100)),
  last_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, track_slug, lesson_slug)
);

-- Resume point: latest activity per user.
create index lesson_progress_recent_idx
  on public.lesson_progress (user_id, last_viewed_at desc);

alter table public.lesson_progress enable row level security;

create policy "Users read their own lesson progress"
  on public.lesson_progress
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert their own lesson progress"
  on public.lesson_progress
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update their own lesson progress"
  on public.lesson_progress
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own lesson progress"
  on public.lesson_progress
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Member projects (saved game / playground state)
-- ---------------------------------------------------------------------------

create table public.member_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_slug text not null check (char_length(track_slug) between 1 and 60),
  lesson_slug text not null check (char_length(lesson_slug) between 1 and 60),
  kind text not null check (char_length(kind) between 1 and 30),
  title text not null check (char_length(title) between 1 and 120),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- One saved project per lesson per user; autosave overwrites in place.
  unique (user_id, track_slug, lesson_slug)
);

create index member_projects_recent_idx
  on public.member_projects (user_id, updated_at desc);

alter table public.member_projects enable row level security;

create policy "Users read their own projects"
  on public.member_projects
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert their own projects"
  on public.member_projects
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update their own projects"
  on public.member_projects
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own projects"
  on public.member_projects
  for delete
  to authenticated
  using (user_id = auth.uid());
