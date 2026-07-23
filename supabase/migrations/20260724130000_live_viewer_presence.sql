-- Persist a live stream's viewer count so the host dashboard's "Peak viewers"
-- stops reading 0.
--
-- The count is presence-based and lives entirely server-side: every viewer's
-- client calls live_heartbeat() every few seconds; the function records the
-- ping, counts the viewers seen in the last ~25s and lifts
-- live_streams.viewer_count to the running peak (greatest()). A client can only
-- ever mark ITSELF present (viewer_id = auth.uid()), so nobody can inflate the
-- number — the count is real rows, not a value the client sends. viewer_count
-- is otherwise locked down for the authenticated role (20260721090000); this
-- function is SECURITY DEFINER (runs as the owner, BYPASSRLS) so it may write it.
-- The dashboard (getHostDashboard) already reads viewer_count as the peak, so no
-- read-side change is needed.

create table if not exists public.live_stream_presence (
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  viewer_id uuid not null,
  last_seen timestamptz not null default now(),
  primary key (stream_id, viewer_id)
);

create index if not exists live_stream_presence_seen_idx
  on public.live_stream_presence (stream_id, last_seen);

-- Locked down: no policies, so the authenticated/anon roles can't touch the
-- table directly through PostgREST. All access is through live_heartbeat().
alter table public.live_stream_presence enable row level security;

create or replace function public.live_heartbeat(p_stream uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_status public.live_stream_status;
  v_count  integer;
begin
  -- Anonymous callers aren't tracked; report nothing rather than erroring.
  if v_viewer is null then
    return 0;
  end if;

  select status into v_status from public.live_streams where id = p_stream;
  -- Unknown stream: no-op.
  if v_status is null then
    return 0;
  end if;
  -- Only live streams accrue viewers. For anything else hand back the stored
  -- (peak) value without recording a presence row.
  if v_status <> 'live' then
    return coalesce(
      (select viewer_count from public.live_streams where id = p_stream), 0);
  end if;

  insert into public.live_stream_presence (stream_id, viewer_id, last_seen)
    values (p_stream, v_viewer, now())
  on conflict (stream_id, viewer_id) do update set last_seen = now();

  -- Keep the table small: drop this stream's long-stale pings.
  delete from public.live_stream_presence
    where stream_id = p_stream and last_seen < now() - interval '90 seconds';

  select count(*) into v_count
    from public.live_stream_presence
    where stream_id = p_stream and last_seen > now() - interval '25 seconds';

  -- Sanity bound; the count is real rows so this is belt-and-braces.
  if v_count < 0 then v_count := 0; end if;
  if v_count > 1000000 then v_count := 1000000; end if;

  update public.live_streams
     set viewer_count = greatest(coalesce(viewer_count, 0), v_count)
   where id = p_stream;

  return v_count;
end;
$$;

grant execute on function public.live_heartbeat(uuid) to authenticated;
