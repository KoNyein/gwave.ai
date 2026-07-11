-- Public learning leaderboard. Aggregates the private lesson_progress table
-- (self-only under RLS) into a ranked, name-resolved list via a SECURITY
-- DEFINER function that exposes ONLY totals + display info — never which
-- lessons anyone took. Two windows: all-time and the current calendar month.

create or replace function public.learn_leaderboard(
  p_period text default 'all',
  p_limit integer default 50
)
returns table (
  rank bigint,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  points integer,
  lessons_completed integer
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      lp.user_id,
      sum(case when lp.status = 'completed' then 10 else 2 end)
        + sum(coalesce(lp.score, 0)) / 10 as points,
      count(*) filter (where lp.status = 'completed') as lessons_completed
    from public.lesson_progress lp
    where p_period <> 'month'
       or lp.last_viewed_at >= date_trunc('month', now())
    group by lp.user_id
  )
  select
    row_number() over (order by s.points desc, s.lessons_completed desc) as rank,
    s.user_id, p.full_name, p.username, p.avatar_url,
    s.points::int, s.lessons_completed::int
  from scoped s
  join public.profiles p on p.id = s.user_id
  where s.points > 0
  order by s.points desc, s.lessons_completed desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke execute on function public.learn_leaderboard(text, integer) from public;
grant execute on function public.learn_leaderboard(text, integer) to authenticated;
