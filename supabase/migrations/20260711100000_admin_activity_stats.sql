-- Admin activity + engagement stats. A single SECURITY DEFINER function
-- (admin-only) returning active-user counts (DAU/WAU/MAU derived from
-- posting/commenting/messaging activity), commerce totals and learning
-- engagement — so the admin overview can show one extra metrics row
-- without N round-trips.

create or replace function public.admin_activity_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  with activity as (
    select author_id as uid, created_at from public.posts
    union all
    select author_id, created_at from public.comments
    union all
    select sender_id, created_at from public.messages
  )
  select jsonb_build_object(
    'dau', (select count(distinct uid) from activity where created_at >= now() - interval '1 day'),
    'wau', (select count(distinct uid) from activity where created_at >= now() - interval '7 days'),
    'mau', (select count(distinct uid) from activity where created_at >= now() - interval '30 days'),
    'total_orders', (select count(*) from public.shop_orders),
    'orders_30d', (select count(*) from public.shop_orders where created_at >= now() - interval '30 days'),
    'delivered_orders', (select count(*) from public.shop_orders where status = 'delivered'),
    'lessons_completed', (select count(*) from public.lesson_progress where status = 'completed'),
    'certificates_issued', (
      select case when to_regclass('public.certificates') is null then 0
                  else (select count(*) from public.certificates) end
    ),
    'active_learners_30d', (select count(distinct user_id) from public.lesson_progress where last_viewed_at >= now() - interval '30 days')
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.admin_activity_stats() from public;
grant execute on function public.admin_activity_stats() to authenticated;
