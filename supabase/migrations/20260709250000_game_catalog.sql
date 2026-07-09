-- Game catalog: a database-driven list of external educational games (PhET
-- simulations, puzzle games, HTML5 games hosted on the operator's own AWS
-- S3/CloudFront, etc.). Each row is just metadata — a title, a thumbnail and
-- the URL that opens in an iframe. Adding a new game is pure data: insert a row
-- here (from the admin form or straight in the SQL Editor) and it appears on
-- the site with no code change.
--
-- Curated by admins; read by everyone. The URLs must point at origins the site
-- trusts to embed in an iframe — configure those via the CSP allowlist
-- (NEXT_PUBLIC_GAME_FRAME_ORIGINS) plus the built-in trusted list in the code.

create table public.game_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  thumbnail_url text not null check (char_length(thumbnail_url) <= 1000),
  game_url text not null check (char_length(game_url) <= 1000),
  category text not null default 'Education'
    check (char_length(category) between 1 and 40),
  -- Hidden games stay in the table but are not shown to visitors.
  is_active boolean not null default true,
  -- Ordering hint; higher shows first, then newest.
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_catalog_browse_idx
  on public.game_catalog (is_active, sort_order desc, created_at desc);
create index game_catalog_category_idx
  on public.game_catalog (category);

create trigger game_catalog_set_updated_at
  before update on public.game_catalog
  for each row execute function public.handle_updated_at();

alter table public.game_catalog enable row level security;

-- Everyone may read active games (this powers the public catalog).
create policy "Active games are viewable by everyone"
  on public.game_catalog
  for select
  using (is_active = true);

-- Admins and moderators manage the catalog. is_admin()/is_moderator() are the
-- project's existing role helpers (used by other admin-curated tables).
create policy "Admins manage the game catalog"
  on public.game_catalog
  for all
  using (public.is_admin() or public.is_moderator())
  with check (public.is_admin() or public.is_moderator());

-- ---------------------------------------------------------------------------
-- A few starter games so the section is not empty. All are free, well-known
-- educational games/simulations. Replace or extend freely.
-- ---------------------------------------------------------------------------
insert into public.game_catalog (title, thumbnail_url, game_url, category, sort_order) values
  (
    'Fraction Matcher',
    'https://phet.colorado.edu/sims/html/fraction-matcher/latest/fraction-matcher-600.png',
    'https://phet.colorado.edu/sims/html/fraction-matcher/latest/fraction-matcher_en.html',
    'Maths', 30
  ),
  (
    'Energy Skate Park',
    'https://phet.colorado.edu/sims/html/energy-skate-park-basics/latest/energy-skate-park-basics-600.png',
    'https://phet.colorado.edu/sims/html/energy-skate-park-basics/latest/energy-skate-park-basics_en.html',
    'Science', 20
  ),
  (
    'Build an Atom',
    'https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom-600.png',
    'https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_en.html',
    'Science', 10
  );
