-- Community gamification — a Creator Leaderboard that rewards members who build
-- and share games, to grow the game / programmer community. Points come from
-- approved games and the plays they earn; the app maps points to badge tiers.
--
-- Exposed as a SECURITY DEFINER function so it can aggregate across all approved
-- games (which are public anyway) and join profile names in one call.

create or replace function public.creator_leaderboard(p_limit int default 50)
returns table (
  author_id uuid,
  username text,
  full_name text,
  avatar_url text,
  games_count bigint,
  total_plays bigint,
  points bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.author_id,
    p.username,
    p.full_name,
    p.avatar_url,
    count(*) as games_count,
    coalesce(sum(g.plays_count), 0) as total_plays,
    count(*) * 100 + coalesce(sum(g.plays_count), 0) as points
  from public.games g
  join public.profiles p on p.id = g.author_id
  where g.status = 'approved'
  group by g.author_id, p.username, p.full_name, p.avatar_url
  order by points desc, games_count desc, total_plays desc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.creator_leaderboard(int) to anon, authenticated;

-- A single member's creator stats (for a profile badge). Same rules.
create or replace function public.creator_stats(p_user uuid)
returns table (games_count bigint, total_plays bigint, points bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) as games_count,
    coalesce(sum(g.plays_count), 0) as total_plays,
    count(*) * 100 + coalesce(sum(g.plays_count), 0) as points
  from public.games g
  where g.author_id = p_user and g.status = 'approved';
$$;

grant execute on function public.creator_stats(uuid) to anon, authenticated;
