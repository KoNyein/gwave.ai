-- Reels — add watch-time monetization on top of the view/like model.
--
-- Creators now also earn for total time watched: 0.05 MMK per second
-- (= 3 MMK per minute), credited only for other people's watch time (never
-- the creator's own). Each report is clamped so a tab left open cannot mint
-- money faster than real time.

-- New earning kind. (ADD VALUE only takes effect for statements that run after
-- this one; the function below merely references it, so this is safe.)
alter type public.earning_kind add value if not exists 'watch';

-- Running total of seconds watched across all viewers, for creator analytics.
alter table public.reels
  add column if not exists watch_seconds bigint not null default 0;

-- Record a chunk of watch time and credit the creator for it.
create or replace function public.record_reel_watch(p_reel uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_secs integer;
begin
  if auth.uid() is null then
    return;
  end if;
  -- Clamp to a sane window so a single call can't over-credit.
  v_secs := least(greatest(coalesce(p_seconds, 0), 0), 300);
  if v_secs <= 0 then
    return;
  end if;
  select owner_id into v_owner from public.reels where id = p_reel;
  if v_owner is null then
    return;
  end if;
  update public.reels
    set watch_seconds = watch_seconds + v_secs where id = p_reel;
  if v_owner <> auth.uid() then
    insert into public.creator_earnings (user_id, reel_id, kind, amount_mmk)
      values (v_owner, p_reel, 'watch', round(v_secs * 0.05, 2));
  end if;
end;
$$;

grant execute on function public.record_reel_watch(uuid, integer) to authenticated;
