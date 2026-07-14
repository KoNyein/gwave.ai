-- ============================================================================
-- Restate the remaining G-Pay price tables in USD (follows the USD repeg).
-- Live-gift catalog prices and reel creator-payout rates were hardcoded MMK;
-- after the repeg those would charge/credit in USD (a "1000" gift = $1000).
-- Set sensible USD prices and convert existing amounts MMK -> USD.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Live gifts — TikTok-style USD price ladder. Relax the >= 1 floor first
-- (a $0.10 rose is below it).
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.live_gifts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%price_mmk%>=%1%'
  loop
    execute format('alter table public.live_gifts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.live_gifts
  add constraint live_gifts_price_min check (price_mmk >= 0.01);

update public.live_gifts set price_mmk = case code
  when 'rose'    then 0.10
  when 'heart'   then 0.25
  when 'cheers'  then 0.50
  when 'party'   then 1.00
  when 'lion'    then 2.00
  when 'rocket'  then 5.00
  when 'crown'   then 10.00
  when 'diamond' then 20.00
  else round(public.gpay_convert(price_mmk, 'MMK', 'USD'), 2)
end;

-- Historical gift events -> USD so leaderboards/totals stay consistent.
update public.live_gift_events
  set amount_mmk = round(public.gpay_convert(amount_mmk, 'MMK', 'USD'), 2)
  where amount_mmk <> 0;

-- ---------------------------------------------------------------------------
-- Reels — creator earnings. Widen to 4 decimals so sub-cent per-view payouts
-- fit, convert existing rows, then repay at USD rates: view $0.001, like $0.003.
-- ---------------------------------------------------------------------------
alter table public.creator_earnings
  alter column amount_mmk type numeric(12, 4);

update public.creator_earnings
  set amount_mmk = round(public.gpay_convert(amount_mmk, 'MMK', 'USD'), 4)
  where amount_mmk <> 0;

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
        values (v_owner, p_reel, 'view', 0.001);
    end if;
  end if;
end;
$$;

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
        values (v_owner, p_reel, 'like', 0.003);
    end if;
    return true;
  end if;
end;
$$;
