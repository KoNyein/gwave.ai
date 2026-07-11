-- Community games — reactions + comments, so a game developer sees how many
-- people played, liked, are interested, and what they commented; and admins
-- can see which games are most popular. Counts are denormalized on games via
-- SECURITY DEFINER triggers (same pattern as posts.reaction_count).

create type public.game_reaction_kind as enum
  ('like', 'love', 'fun', 'interested', 'wow');

-- One reaction per (game, user); changing your mind updates the kind.
create table public.game_reactions (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.game_reaction_kind not null default 'like',
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_reactions_game_idx on public.game_reactions (game_id);
create index game_reactions_user_idx on public.game_reactions (user_id);

create table public.game_comments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index game_comments_game_idx
  on public.game_comments (game_id, created_at desc);

alter table public.games
  add column if not exists reactions_count integer not null default 0
    check (reactions_count >= 0),
  add column if not exists comments_count integer not null default 0
    check (comments_count >= 0);

-- ---------------------------------------------------------------------------
-- Denormalized count triggers
-- ---------------------------------------------------------------------------
create or replace function public.bump_game_reactions_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.games set reactions_count = reactions_count + 1
      where id = new.game_id;
  elsif tg_op = 'DELETE' then
    update public.games set reactions_count = greatest(reactions_count - 1, 0)
      where id = old.game_id;
  end if;
  return null;
end;
$$;

create trigger game_reactions_count
  after insert or delete on public.game_reactions
  for each row execute function public.bump_game_reactions_count();

create or replace function public.bump_game_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.games set comments_count = comments_count + 1
      where id = new.game_id;
  elsif tg_op = 'DELETE' then
    update public.games set comments_count = greatest(comments_count - 1, 0)
      where id = old.game_id;
  end if;
  return null;
end;
$$;

create trigger game_comments_count
  after insert or delete on public.game_comments
  for each row execute function public.bump_game_comments_count();

-- ---------------------------------------------------------------------------
-- RLS — reactions/comments are readable to signed-in users (so authors and
-- admins can see engagement); each user writes only their own.
-- ---------------------------------------------------------------------------
alter table public.game_reactions enable row level security;
alter table public.game_comments enable row level security;

create policy "game reactions readable" on public.game_reactions
  for select to authenticated using (true);
create policy "own game reaction insert" on public.game_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy "own game reaction update" on public.game_reactions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own game reaction delete" on public.game_reactions
  for delete to authenticated using (user_id = auth.uid());

create policy "game comments readable" on public.game_comments
  for select to authenticated using (true);
create policy "own game comment insert" on public.game_comments
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy "own game comment or mod delete" on public.game_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- Reaction breakdown (kind → count) for developer / admin analytics
-- ---------------------------------------------------------------------------
create or replace function public.game_reaction_breakdown(gid uuid)
returns table (kind public.game_reaction_kind, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select kind, count(*) as n
  from public.game_reactions
  where game_id = gid
  group by kind;
$$;

grant execute on function public.game_reaction_breakdown(uuid) to authenticated;
