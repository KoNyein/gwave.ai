-- Community games arcade + post view tracking.
--   * games — HTML5 games uploaded by member developers. Every game runs in a
--     fully sandboxed srcdoc iframe (allow-scripts only, opaque origin), and
--     nothing is publicly listed until a moderator approves it. Author edits
--     force the game back to 'pending' for re-review.
--   * post_views — who has seen a post. One row per (post, viewer); the
--     denormalized posts.view_count is maintained by a security-definer
--     trigger (same pattern as reaction_count). Only the post's author can
--     read the viewer list; viewers can only ever see their own row.

-- ---------------------------------------------------------------------------
-- Community games
-- ---------------------------------------------------------------------------

create type public.game_status as enum ('pending', 'approved', 'rejected');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  emoji text not null default '🎮' check (char_length(emoji) between 1 and 8),
  -- A single self-contained HTML document (inline CSS/JS only — the sandbox
  -- has no network access), capped at 200k characters.
  code text not null check (char_length(code) between 1 and 200000),
  status public.game_status not null default 'pending',
  -- Moderator feedback shown to the author when a game is rejected.
  review_note text check (review_note is null or char_length(review_note) <= 500),
  plays_count integer not null default 0 check (plays_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_status_idx on public.games (status, created_at desc);
create index games_author_idx on public.games (author_id, created_at desc);

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.handle_updated_at();

alter table public.games enable row level security;

-- Approved games are public to signed-in users; authors always see their own
-- submissions; moderators see everything (review queue).
create policy "Approved games are viewable, authors and mods see all"
  on public.games
  for select
  to authenticated
  using (
    status = 'approved'
    or author_id = auth.uid()
    or public.is_moderator()
  );

-- New games always start as pending review.
create policy "Users submit their own games as pending"
  on public.games
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and status = 'pending'
    and not public.is_suspended(auth.uid())
  );

-- Author edits force the game back into review (status must be 'pending' in
-- the new row) — no self-approval path exists.
create policy "Authors can edit their own games back to pending"
  on public.games
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and status = 'pending');

-- Moderators approve/reject (and may edit metadata while doing so).
create policy "Moderators can review games"
  on public.games
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

create policy "Authors and moderators can delete games"
  on public.games
  for delete
  to authenticated
  using (author_id = auth.uid() or public.is_moderator());

-- Play counter: definer function so players don't need UPDATE rights on
-- games. Counts only approved games.
create or replace function public.record_game_play(gid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.games
  set plays_count = plays_count + 1
  where id = gid and status = 'approved';
$$;

revoke execute on function public.record_game_play(uuid) from public;
grant execute on function public.record_game_play(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Post views
-- ---------------------------------------------------------------------------

alter table public.posts
  add column view_count integer not null default 0 check (view_count >= 0);

create table public.post_views (
  post_id uuid not null references public.posts (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);

create index post_views_post_idx on public.post_views (post_id, viewed_at desc);

alter table public.post_views enable row level security;

-- Recording a view: only as yourself, only for posts you are allowed to see,
-- and never for your own posts (self-views don't count).
create policy "Viewers record their own views"
  on public.post_views
  for insert
  to authenticated
  with check (
    viewer_id = auth.uid()
    and public.can_view_post_id(post_id)
    and not exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- The audience list is private to the post's author; a viewer can only ever
-- see their own row.
create policy "Post authors see who viewed their post"
  on public.post_views
  for select
  to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- Keep posts.view_count in sync (definer: the viewer has no UPDATE right on
-- the post row, same pattern as bump_reaction_count).
create or replace function public.bump_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  delta integer;
begin
  target := coalesce(new, old);
  delta := case when tg_op = 'INSERT' then 1
                when tg_op = 'DELETE' then -1
                else 0 end;
  if delta <> 0 then
    update public.posts
    set view_count = greatest(view_count + delta, 0)
    where id = target.post_id;
  end if;
  return null;
end;
$$;

create trigger post_views_bump_count
  after insert or delete on public.post_views
  for each row execute function public.bump_view_count();
