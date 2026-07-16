-- Safety check-in. In a disaster or conflict, a user marks themselves "safe"
-- (or "need help") with one tap; their family circle members are notified and
-- can see everyone's latest status at a glance — like a disaster safety check.

create type public.safety_status as enum ('safe', 'need_help');

create table public.safety_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.safety_status not null default 'safe',
  note text check (note is null or char_length(note) <= 300),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index safety_checkins_user_idx
  on public.safety_checkins (user_id, created_at desc);

alter table public.safety_checkins enable row level security;

create policy "Users check in as themselves"
  on public.safety_checkins for insert to authenticated
  with check (user_id = auth.uid());

-- A user sees their own check-ins and those of anyone in a family circle they
-- both belong to.
create policy "Safety check-ins visible to self and family"
  on public.safety_checkins for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.family_memberships m1
      join public.family_memberships m2 on m1.circle_id = m2.circle_id
      where m1.user_id = auth.uid()
        and m2.user_id = safety_checkins.user_id
    )
  );
