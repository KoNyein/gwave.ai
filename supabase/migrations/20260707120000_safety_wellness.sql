-- Phase 10: trust & safety + wellness.
--   * User blocks (mutual content hiding) with is_blocked().
--   * Soft removal of moderated posts/comments (removed_at) instead of
--     hard deletes, wired into can_view_post_id().
--   * Reports gain a profile target (report a user, not just content).
--   * Age safety: profiles.birth_date, age bands, is_adult()/is_minor()
--     for gating regulated (cannabis) content to verified adults.
--   * Legal consent capture (Terms/Privacy versions, auditable history)
--     and right-to-erasure deletion requests.
--   * Wellness content library (dhamma / meditation / radio / health).

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- Are these two users blocking each other (either direction)?
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

alter table public.blocks enable row level security;

create policy "Users can see their own blocks"
  on public.blocks
  for select
  to authenticated
  using (blocker_id = auth.uid());

create policy "Users can block others"
  on public.blocks
  for insert
  to authenticated
  with check (blocker_id = auth.uid());

create policy "Users can unblock"
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Soft removal of moderated content
-- ---------------------------------------------------------------------------

alter table public.posts add column removed_at timestamptz;
alter table public.comments add column removed_at timestamptz;

-- Reports may now also target a profile.
alter table public.reports
  add column profile_id uuid references public.profiles (id) on delete cascade;

alter table public.reports drop constraint report_single_target;
alter table public.reports add constraint report_single_target check (
  (post_id is not null)::int
    + (comment_id is not null)::int
    + (profile_id is not null)::int = 1
);

-- Central post-visibility check, now also hiding removed posts (except from
-- their author and moderators) and anything between blocked users.
create or replace function public.can_view_post_id(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    left join public.groups g on g.id = p.group_id
    where p.id = pid
      and (p.removed_at is null
        or p.author_id = auth.uid()
        or public.is_moderator())
      and not public.is_blocked(auth.uid(), p.author_id)
      and (
        (p.group_id is not null
          and (g.privacy = 'public' or public.is_group_member(p.group_id)))
        or (p.page_id is not null)
        or (p.group_id is null and p.page_id is null
          and public.can_view_post(p.author_id, p.visibility))
      )
  );
$$;

-- Hide removed comments (except from their author and moderators) and
-- comments from blocked users.
drop policy "Comments are viewable with their post" on public.comments;
create policy "Comments are viewable with their post"
  on public.comments
  for select
  to authenticated
  using (
    public.can_view_post_id(post_id)
    and (removed_at is null
      or author_id = auth.uid()
      or public.is_moderator())
    and not public.is_blocked(auth.uid(), author_id)
  );

-- ---------------------------------------------------------------------------
-- Age safety
-- ---------------------------------------------------------------------------

create type public.age_band as enum ('child', 'preteen', 'teen', 'adult', 'unknown');

alter table public.profiles
  add column birth_date date
    check (birth_date is null or (birth_date > '1900-01-01' and birth_date <= current_date));

-- Age band from a birth date. Depends on current_date, so it is a function
-- rather than a generated column.
create or replace function public.age_band_of(bd date)
returns public.age_band
language sql
stable
as $$
  select case
    when bd is null then 'unknown'::public.age_band
    when bd > current_date - interval '12 years' then 'child'
    when bd > current_date - interval '16 years' then 'preteen'
    when bd > current_date - interval '18 years' then 'teen'
    else 'adult'
  end;
$$;

-- Is the current user a verified adult (18+)? Unknown DOB => NOT adult.
create or replace function public.is_adult()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and birth_date is not null
      and birth_date <= current_date - interval '18 years'
  );
$$;

-- Is the current user a known minor (DOB present and under 18)?
create or replace function public.is_minor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and birth_date is not null
      and birth_date > current_date - interval '18 years'
  );
$$;

-- Convenience: current user's band (for server components / gating).
create or replace function public.my_age_band()
returns public.age_band
language sql
stable
security definer
set search_path = public
as $$
  select public.age_band_of(birth_date) from public.profiles where id = auth.uid();
$$;

-- Note: strain/farm routes are gated app-side via requireAdult(). The public
-- read policies on knowledge tables stay open for the API-key-scoped B2B API.

-- ---------------------------------------------------------------------------
-- Consent records (append-only, auditable history)
-- ---------------------------------------------------------------------------

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  -- For minors: guardian contact captured at signup (the consent workflow
  -- itself is a product/legal decision handled outside the DB).
  guardian_email text check (guardian_email is null or guardian_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  guardian_consent boolean not null default false,
  accepted_at timestamptz not null default now(),
  ip_note text
);

create index consents_user_idx on public.consents (user_id, accepted_at desc);

alter table public.consents enable row level security;

create policy "Users can record their own consent"
  on public.consents
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can read their own consent history"
  on public.consents
  for select
  to authenticated
  using (user_id = auth.uid());

-- Latest accepted versions on the profile for quick gating (e.g. force
-- re-acceptance when the policy version changes).
alter table public.profiles
  add column terms_accepted_version text,
  add column privacy_accepted_version text,
  add column terms_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Account deletion requests (right to erasure)
-- ---------------------------------------------------------------------------

create table public.deletion_requests (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 1000),
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'cancelled'))
);

alter table public.deletion_requests enable row level security;

create policy "Users can request deletion"
  on public.deletion_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can read their own deletion request"
  on public.deletion_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can cancel their own deletion request"
  on public.deletion_requests
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Wellness content library (public read, admin write)
-- ---------------------------------------------------------------------------

create type public.wellness_kind as enum ('dhamma', 'meditation', 'radio', 'health');

create table public.wellness_items (
  id uuid primary key default gen_random_uuid(),
  kind public.wellness_kind not null,
  title text not null,
  body text,
  url text,
  duration_minutes int
    check (duration_minutes is null or duration_minutes between 1 and 600),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index wellness_kind_idx on public.wellness_items (kind, position);

alter table public.wellness_items enable row level security;

create policy "Wellness items are readable by everyone"
  on public.wellness_items
  for select
  using (true);

create policy "Admins can manage wellness items"
  on public.wellness_items
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'super_admin'))
  )
  with check (
    exists (select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'super_admin'))
  );
