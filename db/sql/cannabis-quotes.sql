-- Thai / regional cannabis & hemp price log.
--
-- No exchange trades cannabis flower anywhere, and Thailand's post-2022
-- market is dispensary-and-wholesale, so real prices only exist as trade
-- quotes. This is the hand-recorded log behind /strains/market: an admin
-- records what a grade actually fetched, in which province, on which date.
--
-- Same shape and same guarantees as metal_quotes: RLS enabled with ZERO
-- policies, so PostgREST cannot see the table at all. Everything goes
-- through /api/cannabis/quotes — public GET (the board is 18+ gated at the
-- page), admin-only POST/DELETE after a role check. One gate, one place.
--
-- Run on RDS, then: sudo docker restart postgrest
create table if not exists public.cannabis_quotes (
  id uuid primary key default gen_random_uuid(),
  -- Stable grouping key (e.g. "flower_indoor"), plus the display name.
  product_key text not null,
  name text not null,                    -- "Indoor flower (top shelf)"
  grade text,                            -- "AAA / top shelf", "trim", "smalls"
  price numeric(14, 2) not null check (price > 0),
  currency text not null default 'THB' check (currency in ('THB','USD','MMK')),
  unit text not null,                    -- gram / kg / lb
  market text not null,                  -- "Bangkok", "Chiang Mai", "wholesale"
  note text,
  quoted_at date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Latest quote per (product, market) — what the board shows.
create index if not exists cannabis_quotes_latest_idx
  on public.cannabis_quotes (product_key, market, quoted_at desc, created_at desc);

alter table public.cannabis_quotes enable row level security;
-- Deliberately no policies: invisible to PostgREST, server-only.
