-- Gwave Audio Platform — Phase 0 schema (Music / Podcasts / Audiobooks).
-- Flat tables (assembled in code, no hot-path embeds), owner-only RLS on
-- personal data, public read on the catalogue. Purchases settle atomically
-- through the existing MMK-pegged G-Pay wallet via currency_to_gpay(), mirroring
-- place_dropship_order_gpay. Apply on EC2 then `sudo docker restart postgrest`.

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.audio_tracks (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('music','podcast','audiobook')),
  title          text not null,
  description    text,
  cover_url      text,
  audio_url      text,                            -- HLS manifest or direct file
  transcript_url text,
  duration_s     integer,
  protection     text not null default 'free'
                   check (protection in ('free','signed','drm')),
  price          numeric(14,2),                   -- a-la-carte price (listing ccy)
  currency       text default 'USD',
  is_premium     boolean not null default false,
  publisher_id   uuid references public.profiles(id) on delete set null,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists audio_tracks_kind
  on public.audio_tracks (kind, published_at desc nulls last);

create table if not exists public.audio_music (
  track_id uuid primary key references public.audio_tracks(id) on delete cascade,
  artist   text not null,
  album    text,
  genre    text,
  isrc     char(12),
  track_no integer
);

create table if not exists public.podcast_shows (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  author     text,
  rss_url    text unique,
  category   text,
  cover_url  text,
  created_at timestamptz not null default now()
);
create table if not exists public.audio_podcast (
  track_id   uuid primary key references public.audio_tracks(id) on delete cascade,
  show_id    uuid not null references public.podcast_shows(id) on delete cascade,
  episode_no integer,
  season_no  integer,
  show_notes text,
  guid       text
);
create index if not exists audio_podcast_show on public.audio_podcast (show_id, episode_no);

create table if not exists public.audio_audiobook (
  track_id  uuid primary key references public.audio_tracks(id) on delete cascade,
  author    text not null,
  narrator  text,
  isbn      text,
  publisher text
);
create table if not exists public.audio_chapters (
  id       uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.audio_tracks(id) on delete cascade,
  idx      integer not null,
  title    text not null,
  start_s  integer not null default 0,
  unique (track_id, idx)
);
create index if not exists audio_chapters_track on public.audio_chapters (track_id, idx);

-- Catalogue is publicly readable (published rows).
alter table public.audio_tracks    enable row level security;
alter table public.audio_music     enable row level security;
alter table public.podcast_shows   enable row level security;
alter table public.audio_podcast   enable row level security;
alter table public.audio_audiobook enable row level security;
alter table public.audio_chapters  enable row level security;

drop policy if exists audio_tracks_read on public.audio_tracks;
create policy audio_tracks_read on public.audio_tracks for select using (true);
drop policy if exists audio_music_read on public.audio_music;
create policy audio_music_read on public.audio_music for select using (true);
drop policy if exists podcast_shows_read on public.podcast_shows;
create policy podcast_shows_read on public.podcast_shows for select using (true);
drop policy if exists audio_podcast_read on public.audio_podcast;
create policy audio_podcast_read on public.audio_podcast for select using (true);
drop policy if exists audio_audiobook_read on public.audio_audiobook;
create policy audio_audiobook_read on public.audio_audiobook for select using (true);
drop policy if exists audio_chapters_read on public.audio_chapters;
create policy audio_chapters_read on public.audio_chapters for select using (true);

grant select on public.audio_tracks, public.audio_music, public.podcast_shows,
  public.audio_podcast, public.audio_audiobook, public.audio_chapters to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Personal: cross-device playback progress
-- ---------------------------------------------------------------------------
create table if not exists public.audio_progress (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  track_id    uuid not null references public.audio_tracks(id) on delete cascade,
  position_s  integer not null default 0,
  duration_s  integer,
  chapter_idx integer,
  speed       numeric(3,2) default 1.0,
  completed   boolean not null default false,
  device      text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index if not exists audio_progress_recent
  on public.audio_progress (user_id, updated_at desc);
alter table public.audio_progress enable row level security;
drop policy if exists audio_progress_own on public.audio_progress;
create policy audio_progress_own on public.audio_progress
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.audio_progress to authenticated;

-- ---------------------------------------------------------------------------
-- Entitlements, subscriptions, ratings
-- ---------------------------------------------------------------------------
create table if not exists public.audio_entitlements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  track_id   uuid not null references public.audio_tracks(id) on delete cascade,
  source     text not null check (source in ('purchase','subscription','gift','free')),
  gpay_txn_id uuid references public.gpay_transactions(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, track_id, source)
);
create index if not exists audio_entitlements_user on public.audio_entitlements (user_id, track_id);
alter table public.audio_entitlements enable row level security;
drop policy if exists audio_entitlements_own on public.audio_entitlements;
create policy audio_entitlements_own on public.audio_entitlements
  for select using (user_id = auth.uid());
grant select on public.audio_entitlements to authenticated;

create table if not exists public.audio_plans (
  plan     text primary key,                      -- 'audio_monthly'
  price    numeric(14,2) not null,
  currency text not null default 'USD',
  days     integer not null default 30,
  label    text
);
insert into public.audio_plans (plan, price, currency, days, label)
  values ('audio_monthly', 4.99, 'USD', 30, 'Audio Monthly'),
         ('audio_annual', 49.00, 'USD', 365, 'Audio Annual')
  on conflict (plan) do nothing;
alter table public.audio_plans enable row level security;
drop policy if exists audio_plans_read on public.audio_plans;
create policy audio_plans_read on public.audio_plans for select using (true);
grant select on public.audio_plans to authenticated, anon;

create table if not exists public.audio_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  plan       text not null references public.audio_plans(plan),
  status     text not null default 'active' check (status in ('active','past_due','canceled')),
  renews_at  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.audio_subscriptions enable row level security;
drop policy if exists audio_subscriptions_own on public.audio_subscriptions;
create policy audio_subscriptions_own on public.audio_subscriptions
  for select using (user_id = auth.uid());
grant select on public.audio_subscriptions to authenticated;

create table if not exists public.audio_ratings (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  track_id   uuid not null references public.audio_tracks(id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  review     text,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
alter table public.audio_ratings enable row level security;
drop policy if exists audio_ratings_read on public.audio_ratings;
create policy audio_ratings_read on public.audio_ratings for select using (true);
drop policy if exists audio_ratings_own on public.audio_ratings;
create policy audio_ratings_own on public.audio_ratings
  for insert with check (user_id = auth.uid());
drop policy if exists audio_ratings_update_own on public.audio_ratings;
create policy audio_ratings_update_own on public.audio_ratings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.audio_ratings to authenticated;

-- ---------------------------------------------------------------------------
-- Entitlement check (server-authoritative)
-- ---------------------------------------------------------------------------
create or replace function public.audio_is_entitled(p_track uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select protection = 'free' or is_premium = false
                from public.audio_tracks where id = p_track), false)
    or exists (
      select 1 from public.audio_entitlements
      where user_id = auth.uid() and track_id = p_track
        and (expires_at is null or expires_at > now()))
    or exists (
      select 1 from public.audio_subscriptions
      where user_id = auth.uid() and status = 'active'
        and (renews_at is null or renews_at > now()));
$$;
grant execute on function public.audio_is_entitled(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Buy a single track from the G-Pay wallet (atomic).
-- ---------------------------------------------------------------------------
create or replace function public.buy_audio(p_track uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_track public.audio_tracks;
  v_buyer public.gpay_accounts;
  v_seller public.gpay_accounts;
  v_gpay numeric(14,2);
  v_txn uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Account suspended'; end if;

  select * into v_track from public.audio_tracks where id = p_track;
  if not found then raise exception 'Track not found'; end if;
  if v_track.price is null or v_track.price <= 0 then
    raise exception 'This track is not purchasable';
  end if;

  -- Already owned? Return the existing entitlement's txn (idempotent-ish).
  if exists (select 1 from public.audio_entitlements
             where user_id = auth.uid() and track_id = p_track
               and (expires_at is null or expires_at > now())) then
    return null;
  end if;

  v_gpay := round(public.currency_to_gpay(v_track.price, coalesce(v_track.currency,'USD')), 2);
  if v_gpay is null or v_gpay < 0.01 then
    raise exception 'This currency cannot be paid with G-Pay';
  end if;

  select * into v_buyer from public.gpay_accounts where user_id = auth.uid();
  if not found or v_buyer.status <> 'active' then
    raise exception 'Your G-Pay account is not active';
  end if;
  if v_buyer.balance < v_gpay then
    raise exception 'Insufficient G-Pay balance';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - v_gpay where id = v_buyer.id;

  -- Pay the publisher if they run an active wallet; otherwise book it as a fee.
  if v_track.publisher_id is not null then
    select * into v_seller from public.gpay_accounts
      where user_id = v_track.publisher_id and status = 'active';
  end if;
  if v_seller.id is not null and v_seller.id <> v_buyer.id then
    update public.gpay_accounts set balance = balance + v_gpay where id = v_seller.id;
    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('transfer', v_buyer.id, v_seller.id, v_gpay,
              'Audio: ' || left(coalesce(v_track.title,'track'),120))
      returning id into v_txn;
  else
    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('fee', v_buyer.id, null, v_gpay,
              'Audio: ' || left(coalesce(v_track.title,'track'),120))
      returning id into v_txn;
  end if;

  insert into public.audio_entitlements (user_id, track_id, source, gpay_txn_id)
    values (auth.uid(), p_track, 'purchase', v_txn)
    on conflict (user_id, track_id, source) do nothing;

  return v_txn;
end;
$$;
grant execute on function public.buy_audio(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Subscribe (monthly / annual all-access) from the wallet.
-- ---------------------------------------------------------------------------
create or replace function public.buy_audio_subscription(p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.audio_plans;
  v_buyer public.gpay_accounts;
  v_gpay numeric(14,2);
  v_txn uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Account suspended'; end if;

  select * into v_plan from public.audio_plans where plan = p_plan;
  if not found then raise exception 'Unknown plan'; end if;

  v_gpay := round(public.currency_to_gpay(v_plan.price, v_plan.currency), 2);
  if v_gpay is null or v_gpay < 0.01 then raise exception 'Plan not payable with G-Pay'; end if;

  select * into v_buyer from public.gpay_accounts where user_id = auth.uid();
  if not found or v_buyer.status <> 'active' then raise exception 'Your G-Pay account is not active'; end if;
  if v_buyer.balance < v_gpay then raise exception 'Insufficient G-Pay balance'; end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - v_gpay where id = v_buyer.id;
  insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
    values ('fee', v_buyer.id, null, v_gpay, 'Audio subscription: ' || p_plan)
    returning id into v_txn;

  insert into public.audio_subscriptions (user_id, plan, status, renews_at)
    values (auth.uid(), p_plan, 'active', now() + (v_plan.days || ' days')::interval)
    on conflict (user_id) do update
      set plan = excluded.plan, status = 'active',
          renews_at = greatest(public.audio_subscriptions.renews_at, now()) + (v_plan.days || ' days')::interval;

  return v_txn;
end;
$$;
grant execute on function public.buy_audio_subscription(text) to authenticated;
