-- Live video classrooms for /learn. A classroom is a live_stream with
-- teacher gating, a subject and an optional schedule — so it reuses the
-- entire Mux plumbing (player, chat, reactions, presence, webhook) already
-- built for streaming. Only approved teachers (or admins) may host a class;
-- everyone can watch and chat.

-- Teacher flag, granted by admins. Learners apply → an admin approves.
alter table public.profiles
  add column is_teacher boolean not null default false;

-- Close the self-grant hole: the original self-update policy only pinned
-- `role`, so a learner could set is_teacher=true on their own row via the
-- anon key and bypass approval. Recreate it to pin is_teacher too — the
-- flag can only ever change through the service role (in reviewTeacher…).
drop policy "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_teacher = (select p.is_teacher from public.profiles p where p.id = auth.uid())
  );

-- Classroom facets on the shared streams table.
alter table public.live_streams
  add column kind text not null default 'stream'
    check (kind in ('stream', 'class')),
  -- Which subject a class teaches (a Learn track slug), free text otherwise.
  add column track_slug text
    check (track_slug is null or char_length(track_slug) <= 60),
  -- When a class is scheduled to begin (null = starting now).
  add column scheduled_at timestamptz;

create index live_streams_class_idx
  on public.live_streams (kind, scheduled_at)
  where kind = 'class';

-- Teacher applications: a learner requests, an admin/moderator decides.
create table public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  bio text not null check (char_length(bio) between 1 and 1000),
  subjects text check (subjects is null or char_length(subjects) <= 200),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_applications_status_idx
  on public.teacher_applications (status, created_at desc);

create trigger teacher_applications_set_updated_at
  before update on public.teacher_applications
  for each row execute function public.handle_updated_at();

alter table public.teacher_applications enable row level security;

-- Applicants see their own; moderators see all.
create policy "Applicants and moderators can read applications"
  on public.teacher_applications
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- A learner applies for themselves, always as pending.
create policy "Users apply to teach as themselves"
  on public.teacher_applications
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and not public.is_suspended(auth.uid())
  );

-- Applicants may edit/resubmit their OWN application (the USING clause must
-- match the existing row, which may be 'rejected' — so it can't require
-- pending, or resubmit-after-rejection would be blocked); the WITH CHECK
-- forces the applicant's new row back to 'pending'. Moderators may set any
-- decision.
create policy "Applicants resubmit their own, moderators review"
  on public.teacher_applications
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_moderator())
  with check (
    (user_id = auth.uid() and status = 'pending') or public.is_moderator()
  );
