-- Typing practice results for the language-learning "type" mode. Each completed
-- typing exercise records the learner's speed (WPM) and accuracy so their
-- keyboard skill can be tracked over time, per language.

create table public.typing_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Course slug, e.g. "english", "thai", "japanese".
  lang text not null check (char_length(lang) between 1 and 20),
  wpm integer not null check (wpm between 0 and 400),
  accuracy numeric(5, 2) not null check (accuracy between 0 and 100),
  chars integer not null default 0 check (chars >= 0),
  created_at timestamptz not null default now()
);

create index typing_scores_user_idx
  on public.typing_scores (user_id, lang, created_at desc);

alter table public.typing_scores enable row level security;

-- A learner's typing history is private to them.
create policy "typing scores own read" on public.typing_scores
  for select using (user_id = auth.uid());
create policy "typing scores own insert" on public.typing_scores
  for insert with check (user_id = auth.uid());
