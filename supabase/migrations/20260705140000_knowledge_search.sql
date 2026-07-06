-- Phase 3: knowledge search — cannabis strain and mineral databases with
-- full-text + trigram fuzzy search. Public read, admin-only write.

create extension if not exists pg_trgm;

create type public.strain_type as enum ('indica', 'sativa', 'hybrid');

-- ---------------------------------------------------------------------------
-- Strains (Leafly-style database)
-- ---------------------------------------------------------------------------

create table public.strains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  type public.strain_type not null,
  thc numeric(4, 1) check (thc is null or (thc >= 0 and thc <= 40)),
  cbd numeric(4, 1) check (cbd is null or (cbd >= 0 and cbd <= 30)),
  effects text[] not null default '{}',
  flavors text[] not null default '{}',
  terpenes text[] not null default '{}',
  grow_difficulty text
    check (grow_difficulty in ('easy', 'moderate', 'hard')),
  flowering_weeks integer
    check (flowering_weeks is null or flowering_weeks between 4 and 20),
  yield_indoor text,
  yield_outdoor text,
  description text,
  image_url text,
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strain_slug_format check (slug ~ '^[a-z0-9-]{2,80}$')
);

create index strains_search_tsv_idx on public.strains using gin (search_tsv);
create index strains_name_trgm_idx
  on public.strains using gin (name gin_trgm_ops);
create index strains_type_idx on public.strains (type);
create index strains_thc_idx on public.strains (thc);
create index strains_effects_idx on public.strains using gin (effects);

create trigger strains_set_updated_at
  before update on public.strains
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Minerals / metals
-- ---------------------------------------------------------------------------

create table public.minerals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  symbol text,
  category text not null,
  hardness_mohs numeric(3, 1)
    check (hardness_mohs is null or (hardness_mohs >= 0 and hardness_mohs <= 10)),
  density numeric(6, 2)
    check (density is null or density > 0),
  properties jsonb not null default '{}',
  uses text[] not null default '{}',
  description text,
  image_url text,
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(symbol, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mineral_slug_format check (slug ~ '^[a-z0-9-]{2,80}$')
);

create index minerals_search_tsv_idx on public.minerals using gin (search_tsv);
create index minerals_name_trgm_idx
  on public.minerals using gin (name gin_trgm_ops);
create index minerals_category_idx on public.minerals (category);

create trigger minerals_set_updated_at
  before update on public.minerals
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: public read (no auth required), admin-only write
-- ---------------------------------------------------------------------------

-- True when the current user is an admin or super_admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin')
  );
$$;

alter table public.strains enable row level security;
alter table public.minerals enable row level security;

create policy "Strains are publicly readable"
  on public.strains
  for select
  to anon, authenticated
  using (true);

create policy "Admins can insert strains"
  on public.strains
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update strains"
  on public.strains
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete strains"
  on public.strains
  for delete
  to authenticated
  using (public.is_admin());

create policy "Minerals are publicly readable"
  on public.minerals
  for select
  to anon, authenticated
  using (true);

create policy "Admins can insert minerals"
  on public.minerals
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update minerals"
  on public.minerals
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete minerals"
  on public.minerals
  for delete
  to authenticated
  using (public.is_admin());
