-- Screen time as a first-class daily health metric. Raw rows land in
-- health_metrics as metric_type = 'screen_time' (free-text column, no
-- constraint change needed); the dashboard reads the pre-aggregated daily
-- summary, which needs the new column.
alter table public.health_daily_summary
  add column if not exists screen_minutes integer;
