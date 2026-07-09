-- Learning levels: a public aggregate over the private lesson_progress
-- table. lesson_progress rows are self-only under RLS, but the level badge
-- on profiles should be visible to everyone — so a definer function exposes
-- ONLY the total points (completed lessons + quiz scores), never which
-- lessons someone took.

create or replace function public.learning_points(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    sum(case when status = 'completed' then 10 else 2 end)
      + sum(coalesce(score, 0)) / 10,
    0
  )::int
  from public.lesson_progress
  where user_id = uid;
$$;

revoke execute on function public.learning_points(uuid) from public;
grant execute on function public.learning_points(uuid) to authenticated;
