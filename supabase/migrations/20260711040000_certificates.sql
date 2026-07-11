-- Course completion certificates. Awarded server-side (service role only —
-- no client insert policy) once every lesson in a track is completed in
-- lesson_progress. Publicly readable so certificate links can be shared
-- and verified by anyone.

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_slug text not null check (char_length(track_slug) between 1 and 60),
  track_title text not null check (char_length(track_title) between 1 and 120),
  lessons_completed integer not null check (lessons_completed > 0),
  issued_at timestamptz not null default now(),
  unique (user_id, track_slug)
);

create index certificates_user_idx
  on public.certificates (user_id, issued_at desc);

alter table public.certificates enable row level security;

-- Anyone can view/verify a certificate (shared links). Inserts happen only
-- through the trusted server action using the service role, which bypasses
-- RLS — so no insert/update/delete policies are defined at all.
create policy "certificates are publicly readable" on public.certificates
  for select using (true);
