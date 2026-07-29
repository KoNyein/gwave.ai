-- Live announcement posts: give each live stream at most ONE feed post,
-- enforced by the database instead of application-level check-then-insert
-- (which raced under concurrent verify healers and produced duplicates —
-- and the delete-based cleanup for those duplicates could remove the very
-- post a follower notification linked to, 404ing the notification).
--
-- Run in the SQL editor / dockerised psql, then: sudo docker restart postgrest

alter table public.posts
  add column if not exists live_stream_id uuid
    references public.live_streams(id) on delete set null;

-- One announcement per stream. NOT partial: PostgREST sends a predicate-free
-- ON CONFLICT (live_stream_id), which Postgres cannot match against a partial
-- index — the upsert would error out on every announcement. A plain unique
-- index is equivalent here anyway: Postgres allows unlimited NULLs, so
-- ordinary posts (live_stream_id is null) are unaffected.
create unique index if not exists posts_live_announce_uq
  on public.posts (live_stream_id);

-- Backfill existing announcement posts (🔴-prefixed, carrying /live/<uuid>)
-- so the upsert path dedupes against them too. Wrap-up posts (📼) are left
-- alone — only the announcement is unique per stream. Oldest one wins where
-- history already holds duplicates.
--
-- The UUID pattern is canonical (8-4-4-4-12), not a loose [0-9a-f-]{36}: a
-- user-written post containing e.g. 36 hyphens would otherwise reach the
-- ::uuid cast and abort the whole statement.
with candidates as (
  select id,
         ((regexp_match(
             content,
             '/live/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
           ))[1])::uuid as sid,
         row_number() over (
           partition by (regexp_match(
             content,
             '/live/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
           ))[1]
           order by created_at asc, id asc
         ) as rn
  from public.posts
  where live_stream_id is null
    and content like '🔴%'
    and content ~ '/live/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
)
update public.posts p
set live_stream_id = c.sid
from candidates c
where p.id = c.id
  and c.rn = 1
  and exists (select 1 from public.live_streams s where s.id = c.sid);

select 'live-announce-post: done' as status;
