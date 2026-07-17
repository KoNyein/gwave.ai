-- Wearable / health-data integration. Users connect a device provider (Garmin,
-- Apple, Fitbit, Oura, Samsung, …) through the Terra aggregator; Terra then
-- pushes normalized metrics to our webhook, which lands them here. A daily
-- summary row is pre-aggregated so the dashboard stays fast at scale.
--
-- Idempotent: safe to re-run (no migration ledger — files are piped into psql).

create table if not exists public.health_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  terra_user_id text not null,
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked')),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  unique (user_id, provider)
);
create index if not exists health_connections_user_idx
  on public.health_connections (user_id);
-- The webhook resolves the app user from Terra's user id, so index it.
create index if not exists health_connections_terra_idx
  on public.health_connections (terra_user_id);

create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  metric_type text not null,   -- steps | heart_rate | sleep | calories | workout | spo2 | temperature | hydration
  value numeric not null,
  unit text,
  recorded_at timestamptz not null,
  day date not null,
  raw jsonb,
  -- One reading per (user, type, timestamp): re-delivered webhooks are idempotent.
  unique (user_id, metric_type, recorded_at)
);
create index if not exists health_metrics_lookup_idx
  on public.health_metrics (user_id, metric_type, recorded_at desc);

create table if not exists public.health_daily_summary (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  steps integer,
  avg_hr integer,
  resting_hr integer,
  sleep_minutes integer,
  calories integer,
  active_minutes integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.health_connections enable row level security;
alter table public.health_metrics enable row level security;
alter table public.health_daily_summary enable row level security;

-- All three are strictly owner-private: a user sees only their own health data.
-- Writes come from the webhook via the service role (which bypasses RLS), so no
-- insert/update policy is granted to authenticated — reads only.
drop policy if exists "Own health connections" on public.health_connections;
create policy "Own health connections"
  on public.health_connections for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Delete own health connections" on public.health_connections;
create policy "Delete own health connections"
  on public.health_connections for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Own health metrics" on public.health_metrics;
create policy "Own health metrics"
  on public.health_metrics for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Own health summary" on public.health_daily_summary;
create policy "Own health summary"
  on public.health_daily_summary for select to authenticated
  using (user_id = auth.uid());

-- Self-hosted PostgREST parity: the API roles need table-level GRANTs (RLS is
-- still the gate). Mirrors 20260717000000_grant_api_roles for these new tables.
grant select on public.health_connections, public.health_metrics,
  public.health_daily_summary to authenticated;
grant select, insert, update, delete on public.health_connections,
  public.health_metrics, public.health_daily_summary to service_role;
