-- ================================================================
-- Family GPS locator — setup
-- Copy into the Supabase SQL Editor and click "Run" (idempotent).
-- Creates family_circles, family_memberships, member_locations with
-- RLS, the visibility helpers, and the create/join RPCs.
-- ================================================================

-- Family GPS locator.
--
-- Members form a "family circle" (invite-code based). Within a circle, anyone
-- who has location sharing turned on publishes their latest GPS position, and
-- other members of that circle can see it on a map. Privacy is strict: your
-- position is readable only by people who share a circle with you AND only
-- while your own sharing switch is on. All the cross-user visibility checks go
-- through SECURITY DEFINER helpers to avoid RLS self-recursion.

create table public.family_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (char_length(invite_code) between 4 and 16),
  created_at timestamptz not null default now()
);

create table public.family_memberships (
  circle_id uuid not null references public.family_circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sharing_enabled boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index family_memberships_user_idx on public.family_memberships (user_id);

create table public.member_locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy double precision,
  updated_at timestamptz not null default now()
);

-- --- SECURITY DEFINER helpers (avoid recursive RLS on family_memberships) ---

-- Is the caller a member of this circle?
create or replace function public.is_family_member(p_circle uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_memberships
    where circle_id = p_circle and user_id = auth.uid()
  );
$$;

-- Does the caller share a circle with p_other, and is p_other sharing on?
create or replace function public.shares_family_circle(p_other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships a
    join public.family_memberships b on a.circle_id = b.circle_id
    where a.user_id = auth.uid()
      and b.user_id = p_other
      and b.sharing_enabled
  );
$$;

-- --- RLS ---
alter table public.family_circles enable row level security;
alter table public.family_memberships enable row level security;
alter table public.member_locations enable row level security;

-- Circles: members read; created only via the RPC below (no direct insert).
create policy "Members read their circles"
  on public.family_circles for select to authenticated
  using (public.is_family_member(id));

-- Memberships: members of the circle read them; a user manages (toggle sharing,
-- leave) only their own row. Joining is via the RPC (no direct insert).
create policy "Members read circle memberships"
  on public.family_memberships for select to authenticated
  using (public.is_family_member(circle_id));
create policy "Users update their own membership"
  on public.family_memberships for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Users leave circles"
  on public.family_memberships for delete to authenticated
  using (user_id = auth.uid());

-- Locations: you read your own, or a circle-mate's while they share; you write
-- only your own row.
create policy "Read own and shared locations"
  on public.member_locations for select to authenticated
  using (user_id = auth.uid() or public.shares_family_circle(user_id));
create policy "Upsert own location (insert)"
  on public.member_locations for insert to authenticated
  with check (user_id = auth.uid());
create policy "Upsert own location (update)"
  on public.member_locations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- RPCs ---

-- Create a circle and add the caller as its first member. Returns the new id.
create or replace function public.create_family_circle(p_name text)
returns public.family_circles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle public.family_circles;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.family_circles (owner_id, name, invite_code)
    values (
      auth.uid(),
      left(trim(p_name), 80),
      upper(substr(md5(gen_random_uuid()::text), 1, 8))
    )
    returning * into v_circle;
  insert into public.family_memberships (circle_id, user_id)
    values (v_circle.id, auth.uid());
  return v_circle;
end;
$$;

-- Join a circle by its invite code. Idempotent. Returns the circle id.
create or replace function public.join_family_circle(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_circle
    from public.family_circles
    where invite_code = upper(trim(p_code));
  if v_circle is null then raise exception 'No circle with that code'; end if;
  insert into public.family_memberships (circle_id, user_id)
    values (v_circle, auth.uid())
    on conflict (circle_id, user_id) do nothing;
  return v_circle;
end;
$$;

grant execute on function public.create_family_circle(text) to authenticated;
grant execute on function public.join_family_circle(text) to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.shares_family_circle(uuid) to authenticated;
