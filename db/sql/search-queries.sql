-- Search keyword log.
--
-- What users type into search is the clearest signal of what they came for and
-- what the app failed to give them. This records the query, who typed it, where
-- from, and how many results came back — so the admin dashboard can show both
-- the popular searches and, more usefully, the ones that returned NOTHING.
--
-- Only the query text is stored, never page content, and the row is tied to a
-- profile so an admin can see one user's searches. RLS is enabled with ZERO
-- policies: invisible to PostgREST, written by /api/search server-side and read
-- only through the admin dashboard's service client.
--
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.search_queries (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  -- Normalised (trimmed, lower-cased) so "OG Kush" and "og kush" group.
  q text not null check (length(btrim(q)) between 2 and 100),
  -- Which box: global navbar, strains, minerals, tools, shop…
  source text not null default 'global',
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Top keywords over a window: the dashboard's main query.
create index if not exists search_queries_q_idx
  on public.search_queries (q, created_at desc);

-- Activity over time + recent feed.
create index if not exists search_queries_time_idx
  on public.search_queries (created_at desc);

-- Per-user drill-down.
create index if not exists search_queries_user_idx
  on public.search_queries (user_id, created_at desc);

-- "Searches that found nothing" — the gap list worth acting on.
create index if not exists search_queries_zero_idx
  on public.search_queries (result_count, created_at desc)
  where result_count = 0;

alter table public.search_queries enable row level security;
-- Deliberately no policies: server-only.
