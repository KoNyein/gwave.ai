-- Reviews & ratings — users rate and comment on teachers/farm-owners (profiles),
-- businesses (pages / shops) and shop products. One review per user per subject,
-- 1–5 stars, no reviewing your own thing. Aggregates power a public leaderboard.
--
-- Reviews are world-readable. Writes go through upsert_review (SECURITY DEFINER)
-- which validates the subject exists and isn't the reviewer's own; a reviewer
-- may delete their own review directly.

create type public.review_subject as enum ('profile', 'page', 'shop_product');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  subject_type public.review_subject not null,
  subject_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per reviewer per subject (upsert target).
  unique (reviewer_id, subject_type, subject_id)
);

create index reviews_subject_idx
  on public.reviews (subject_type, subject_id, created_at desc);
create index reviews_reviewer_idx on public.reviews (reviewer_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.handle_updated_at();

alter table public.reviews enable row level security;

-- Anyone may read reviews; a reviewer may delete their own. Inserts/updates go
-- through the RPC so ownership and subject-existence are always checked.
create policy "reviews public read" on public.reviews
  for select using (true);
create policy "reviews delete own" on public.reviews
  for delete using (reviewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Does the caller own the subject? (used to block self-reviews)
-- ---------------------------------------------------------------------------
create or replace function public.owns_review_subject(
  p_type public.review_subject,
  p_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'profile' then p_id = auth.uid()
    when 'page' then exists (
      select 1 from public.pages where id = p_id and owner_id = auth.uid()
    )
    when 'shop_product' then exists (
      select 1 from public.shop_products where id = p_id and seller_id = auth.uid()
    )
    else false
  end;
$$;

-- Does the subject exist at all?
create or replace function public.review_subject_exists(
  p_type public.review_subject,
  p_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'profile' then exists (select 1 from public.profiles where id = p_id)
    when 'page' then exists (select 1 from public.pages where id = p_id)
    when 'shop_product' then exists (select 1 from public.shop_products where id = p_id)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_review — create or update the caller's review of a subject
-- ---------------------------------------------------------------------------
create or replace function public.upsert_review(
  p_subject_type public.review_subject,
  p_subject_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  if not public.review_subject_exists(p_subject_type, p_subject_id) then
    raise exception 'That item does not exist';
  end if;
  if public.owns_review_subject(p_subject_type, p_subject_id) then
    raise exception 'You cannot review your own item';
  end if;

  insert into public.reviews (reviewer_id, subject_type, subject_id, rating, comment)
    values (auth.uid(), p_subject_type, p_subject_id, p_rating,
            nullif(btrim(p_comment), ''))
    on conflict (reviewer_id, subject_type, subject_id)
    do update set rating = excluded.rating,
                  comment = excluded.comment,
                  updated_at = now()
    returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- review_stats — count + average for one subject
-- ---------------------------------------------------------------------------
create or replace function public.review_stats(
  p_subject_type public.review_subject,
  p_subject_id uuid
)
returns table (rating_count bigint, rating_avg numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint,
         coalesce(round(avg(rating)::numeric, 2), 0)
  from public.reviews
  where subject_type = p_subject_type and subject_id = p_subject_id;
$$;

-- ---------------------------------------------------------------------------
-- review_leaderboard — top-rated subjects of a type
-- ---------------------------------------------------------------------------
-- Ranked by a Bayesian-adjusted score so a single 5★ doesn't outrank a well-
-- reviewed 4.8★. score = (v/(v+m))·R + (m/(v+m))·C, with a prior of m reviews
-- at the global mean C. Only subjects with at least p_min_reviews are listed.
create or replace function public.review_leaderboard(
  p_subject_type public.review_subject,
  p_limit integer default 20,
  p_min_reviews integer default 1
)
returns table (
  subject_id uuid,
  rating_count bigint,
  rating_avg numeric,
  score numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with agg as (
    select subject_id,
           count(*)::bigint as rating_count,
           avg(rating)::numeric as rating_avg
    from public.reviews
    where subject_type = p_subject_type
    group by subject_id
  ),
  prior as (
    select coalesce(avg(rating_avg), 4.0) as c from agg
  )
  select a.subject_id,
         a.rating_count,
         round(a.rating_avg, 2) as rating_avg,
         round(
           (a.rating_count::numeric / (a.rating_count + 5)) * a.rating_avg
           + (5::numeric / (a.rating_count + 5)) * (select c from prior),
           3
         ) as score
  from agg a
  where a.rating_count >= greatest(1, coalesce(p_min_reviews, 1))
  order by score desc, a.rating_count desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.owns_review_subject(public.review_subject, uuid) to authenticated;
grant execute on function public.review_subject_exists(public.review_subject, uuid) to authenticated;
grant execute on function public.upsert_review(public.review_subject, uuid, integer, text) to authenticated;
grant execute on function public.review_stats(public.review_subject, uuid) to authenticated, anon;
grant execute on function public.review_leaderboard(public.review_subject, integer, integer) to authenticated, anon;
