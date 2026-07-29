-- Monetization guard: a reel only earns money once its creator has confirmed
-- it is their own original work (no copyright infringement). Views, likes and
-- watch-time are still counted for everyone, but creator_earnings rows are
-- written *only* for reels with original_confirmed = true. If a reel is later
-- found to infringe, an admin can flip the flag off and no further money accrues.

alter table public.reels
  add column if not exists original_confirmed boolean not null default false;

-- View: count for everyone; credit only confirmed-original reels.
create or replace function public.record_reel_view(p_reel uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_orig boolean;
begin
  if auth.uid() is null then
    return;
  end if;
  select owner_id, original_confirmed into v_owner, v_orig
    from public.reels where id = p_reel;
  if v_owner is null then
    return;
  end if;
  insert into public.reel_views (reel_id, viewer_id)
    values (p_reel, auth.uid())
    on conflict do nothing;
  if found then
    update public.reels set view_count = view_count + 1 where id = p_reel;
    if v_owner <> auth.uid() and v_orig then
      insert into public.creator_earnings (user_id, reel_id, kind, amount_mmk)
        values (v_owner, p_reel, 'view', 1.00);
    end if;
  end if;
end;
$$;

-- Like: count for everyone; credit only confirmed-original reels.
create or replace function public.toggle_reel_like(p_reel uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_orig boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select owner_id, original_confirmed into v_owner, v_orig
    from public.reels where id = p_reel;
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
    if v_owner <> auth.uid() and v_orig then
      insert into public.creator_earnings (user_id, reel_id, kind, amount_mmk)
        values (v_owner, p_reel, 'like', 3.00);
    end if;
    return true;
  end if;
end;
$$;

-- Watch-time: accumulate seconds for everyone; credit only confirmed-original.
create or replace function public.record_reel_watch(p_reel uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_orig boolean;
  v_secs integer;
begin
  if auth.uid() is null then
    return;
  end if;
  v_secs := least(greatest(coalesce(p_seconds, 0), 0), 300);
  if v_secs <= 0 then
    return;
  end if;
  select owner_id, original_confirmed into v_owner, v_orig
    from public.reels where id = p_reel;
  if v_owner is null then
    return;
  end if;
  update public.reels
    set watch_seconds = watch_seconds + v_secs where id = p_reel;
  if v_owner <> auth.uid() and v_orig then
    insert into public.creator_earnings (user_id, reel_id, kind, amount_mmk)
      values (v_owner, p_reel, 'watch', round(v_secs * 0.05, 2));
  end if;
end;
$$;
