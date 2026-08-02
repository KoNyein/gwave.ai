-- Reels — short vertical videos with view / like monetization.
--
-- A reel is a short video stored in the public "media" bucket. Anyone can
-- watch public reels; the feed counts one unique view per viewer. Creators
-- earn play-money (MMK) for each unique view and like their reels receive,
-- accrued in the creator_earnings ledger, and can withdraw the balance into
-- their active G-Pay wallet.
--
-- All counters and earnings are changed only inside SECURITY DEFINER functions
-- (record_reel_view, toggle_reel_like, withdraw_reel_earnings) so viewers can
-- neither inflate counts nor credit themselves directly.

create type public.earning_kind as enum ('view', 'like', 'bonus');

-- ---------------------------------------------------------------------------
-- Reels
-- ---------------------------------------------------------------------------
create table public.reels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Path within the public "media" bucket.
  video_path text not null,
  poster_path text,
  caption text check (caption is null or char_length(caption) <= 500),
  view_count integer not null default 0,
  like_count integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index reels_created_idx on public.reels (created_at desc);
create index reels_owner_idx on public.reels (owner_id, created_at desc);

-- One counted view per viewer per reel.
create table public.reel_views (
  reel_id uuid not null references public.reels (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, viewer_id)
);

create table public.reel_likes (
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Creator earnings ledger
-- ---------------------------------------------------------------------------
create table public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  -- The creator who earned it.
  user_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid references public.reels (id) on delete set null,
  kind public.earning_kind not null,
  amount_mmk numeric(12, 2) not null check (amount_mmk >= 0),
  paid_out boolean not null default false,
  created_at timestamptz not null default now()
);

create index creator_earnings_user_idx
  on public.creator_earnings (user_id, paid_out, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.reels enable row level security;
alter table public.reel_views enable row level security;
alter table public.reel_likes enable row level security;
alter table public.creator_earnings enable row level security;

-- Reels: public reels are world-readable; owners manage their own.
create policy "reels read" on public.reels
  for select using (is_public or owner_id = auth.uid());
create policy "reels insert own" on public.reels
  for insert with check (owner_id = auth.uid());
create policy "reels update own" on public.reels
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "reels delete own" on public.reels
  for delete using (owner_id = auth.uid());

-- A viewer may read their own view/like rows (to know "did I like this?"); the
-- public counters live on the reels row. All writes go through the RPCs below.
create policy "reel_views read own" on public.reel_views
  for select using (viewer_id = auth.uid());
create policy "reel_likes read own" on public.reel_likes
  for select using (user_id = auth.uid());

-- Earnings are visible only to the creator who earned them.
create policy "earnings read own" on public.creator_earnings
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Monetization rates (play-money MMK)
-- ---------------------------------------------------------------------------
-- view = 1 MMK, like = 3 MMK. Encoded in the functions below.

-- Count a unique view and credit the creator once per viewer.
create or replace function public.record_reel_view(p_reel uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    return;
  end if;
  select owner_id into v_owner from public.reels where id = p_reel;
  if v_owner is null then
    return;
  end if;
  insert into public.reel_views (reel_id, viewer_id)
    values (p_reel, auth.uid())
    on conflict do nothing;
  if found then
    update public.reels set view_count = view_count + 1 where id = p_reel;
    if v_owner <> auth.uid() then
      insert into public.creator_earnings (user_id, reel_id, kind, amount_mmk)
        values (v_owner, p_reel, 'view', 1.00);
    end if;
  end if;
end;
$$;

-- Toggle a like; credit the creator on a new like (never on self-likes).
create or replace function public.toggle_reel_like(p_reel uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  select owner_id into v_owner from public.reels where id = p_reel;
  if v_owner is null then
    return false;
  end if;
  if exists (
    select 1 from public.reel_likes
    where reel_id = p_reel and user_id = auth.uid()
  ) then
    delete from public.reel_likes
      where reel_id = p_reel and user_id = auth.uid();
    update public.reels
      set like_count = greatest(0, like_count - 1) where id = p_reel;
    return false;
  else
    insert into public.reel_likes (reel_id, user_id)
      values (p_reel, auth.uid());
    update public.reels set like_count = like_count + 1 where id = p_reel;
    if v_owner <> auth.uid() then
      insert into public.creator_earnings (user_id, reel_id, kind, amount_mmk)
        values (v_owner, p_reel, 'like', 3.00);
    end if;
    return true;
  end if;
end;
$$;

-- Withdraw all unpaid earnings into the caller's active G-Pay wallet. Uses the
-- gpay.allow_ledger flag so the wallet guard trigger permits the credit.
create or replace function public.withdraw_reel_earnings()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(12, 2);
  v_acct uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into v_acct
    from public.gpay_accounts
    where user_id = auth.uid() and status = 'active';
  if v_acct is null then
    raise exception 'An active G-Pay account is required to withdraw';
  end if;
  select coalesce(sum(amount_mmk), 0) into v_amount
    from public.creator_earnings
    where user_id = auth.uid() and not paid_out;
  if v_amount <= 0 then
    return 0;
  end if;
  update public.creator_earnings
    set paid_out = true
    where user_id = auth.uid() and not paid_out;
  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts
    set balance = balance + v_amount where id = v_acct;
  insert into public.gpay_transactions (kind, to_account, amount, note)
    values ('topup', v_acct, v_amount, 'Reel earnings withdrawal');
  perform set_config('gpay.allow_ledger', 'off', true);
  return v_amount;
end;
$$;

grant execute on function public.record_reel_view(uuid) to authenticated;
grant execute on function public.toggle_reel_like(uuid) to authenticated;
grant execute on function public.withdraw_reel_earnings() to authenticated;
