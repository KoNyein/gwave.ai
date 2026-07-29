-- Audio ratings aggregate. The audio_ratings table + its RLS ships in
-- audio-platform.sql; this adds the average/count helper the store reads.
-- Apply on EC2 then `sudo docker restart postgrest`.

create or replace function public.audio_rating_stats(p_track uuid)
returns table (avg_stars numeric, cnt integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(round(avg(stars), 2), 0)::numeric, count(*)::int
  from public.audio_ratings
  where track_id = p_track;
$$;
grant execute on function public.audio_rating_stats(uuid) to authenticated, anon;
