-- Creator analytics — daily & monthly time-series from the earnings ledger.
--
-- Every view / like / watch chunk is one creator_earnings row, so we can
-- aggregate it by day and month (in Myanmar time) to show a creator how their
-- reels performed over time. SECURITY INVOKER + the ledger's own-rows RLS means
-- a caller only ever sees their own numbers.
--
-- watch_seconds is derived back from the 0.05 MMK/sec rate.

create or replace function public.creator_daily_stats(p_days integer default 30)
returns table (
  day date,
  views bigint,
  likes bigint,
  watch_seconds numeric,
  earnings numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (created_at at time zone 'Asia/Yangon')::date as day,
    count(*) filter (where kind = 'view') as views,
    count(*) filter (where kind = 'like') as likes,
    round(coalesce(sum(amount_mmk) filter (where kind = 'watch'), 0) / 0.05) as watch_seconds,
    coalesce(sum(amount_mmk), 0) as earnings
  from public.creator_earnings
  where user_id = auth.uid()
    and created_at >= (now() - make_interval(days => greatest(1, least(p_days, 366))))
  group by 1
  order by 1;
$$;

create or replace function public.creator_monthly_stats(p_months integer default 12)
returns table (
  month text,
  views bigint,
  likes bigint,
  watch_seconds numeric,
  earnings numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_char((created_at at time zone 'Asia/Yangon'), 'YYYY-MM') as month,
    count(*) filter (where kind = 'view') as views,
    count(*) filter (where kind = 'like') as likes,
    round(coalesce(sum(amount_mmk) filter (where kind = 'watch'), 0) / 0.05) as watch_seconds,
    coalesce(sum(amount_mmk), 0) as earnings
  from public.creator_earnings
  where user_id = auth.uid()
    and created_at >= (now() - make_interval(months => greatest(1, least(p_months, 60))))
  group by 1
  order by 1;
$$;

grant execute on function public.creator_daily_stats(integer) to authenticated;
grant execute on function public.creator_monthly_stats(integer) to authenticated;
