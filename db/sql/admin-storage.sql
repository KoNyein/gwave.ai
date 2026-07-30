-- Storage introspection for the admin dashboard.
--
-- "How much data does the system actually hold, and where is it?" is a
-- question the app could not answer: PostgREST serves rows, not catalogue
-- views, and it has no GROUP BY, so per-table size had to come from a real SQL
-- function. These two do exactly that and nothing else.
--
-- SECURITY DEFINER because pg_catalog sizes need an owner's view of every
-- table, but EXECUTE is revoked from public/anon/authenticated and granted only
-- to service_role — the same "one gate, one place" rule the RLS-sealed tables
-- follow. A signed-in user cannot call these; only /api/admin/storage can,
-- after its own admin role check.
--
-- Run on RDS, then: sudo docker restart postgrest
create or replace function public.admin_storage_tables()
returns table (
  table_name text,
  row_estimate bigint,
  total_bytes bigint,
  heap_bytes bigint,
  index_bytes bigint,
  toast_bytes bigint
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    c.relname::text,
    -- reltuples is the planner's estimate, refreshed by ANALYZE. Exact counts
    -- would mean a seq scan of every table on every dashboard load; for "how
    -- big is this" the estimate is the right trade.
    greatest(c.reltuples, 0)::bigint,
    pg_total_relation_size(c.oid)::bigint,
    pg_relation_size(c.oid)::bigint,
    pg_indexes_size(c.oid)::bigint,
    coalesce(pg_total_relation_size(c.reltoastrelid), 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'm')   -- tables, partitioned tables, matviews
  order by pg_total_relation_size(c.oid) desc;
$$;

revoke execute on function public.admin_storage_tables() from public;
revoke execute on function public.admin_storage_tables() from anon;
revoke execute on function public.admin_storage_tables() from authenticated;
grant execute on function public.admin_storage_tables() to service_role;

-- Whole-database totals, so the page can lead with one number instead of
-- making the reader add up a table list.
create or replace function public.admin_storage_summary()
returns table (
  database_name text,
  database_bytes bigint,
  table_count integer,
  index_count integer,
  largest_table text,
  largest_table_bytes bigint
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with t as (
    select c.relname::text as name, pg_total_relation_size(c.oid) as bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'm')
  )
  select
    current_database()::text,
    pg_database_size(current_database())::bigint,
    (select count(*) from t)::integer,
    (select count(*) from pg_indexes where schemaname = 'public')::integer,
    (select name from t order by bytes desc limit 1),
    coalesce((select bytes from t order by bytes desc limit 1), 0)::bigint;
$$;

revoke execute on function public.admin_storage_summary() from public;
revoke execute on function public.admin_storage_summary() from anon;
revoke execute on function public.admin_storage_summary() from authenticated;
grant execute on function public.admin_storage_summary() to service_role;
