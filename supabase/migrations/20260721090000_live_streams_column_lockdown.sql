-- Close the column-blind UPDATE hole on live_streams.
--
-- The original policy only pinned the ROW ("host_id = auth.uid()"), not the
-- COLUMNS, so any signed-in host could PATCH their own stream through
-- PostgREST and rewrite server-owned fields:
--   * kind = 'class'  → self-promotion into the teacher-gated /learn classrooms
--     (the is_teacher check lives in POST /api/live/create only, and profiles
--      already pins is_teacher — this was the way around it)
--   * livekit_room    → point their row at somebody else's SFU room, then have
--     getLiveStageToken() mint them a *publish* token for it (host ⇒ canPublish)
--   * status/ended_at → resurrect an ended broadcast, or fake "Live now"
--   * viewer_count, mux_*/ivs_*/agora_*/recording_* → forge stats & provisioning
--
-- Column-level GRANTs were the other candidate fix, but 20260717000000_grant_api_roles
-- re-grants table-wide UPDATE to `authenticated` and is documented as safe to
-- re-run — it would silently undo them. Doing it in the policy survives that.
--
-- Approach: deny-by-default on columns. Everything in the row must be byte-for-byte
-- unchanged EXCEPT an explicit allow-list, so columns added by future migrations
-- are locked down automatically instead of being writable until someone notices.
--
-- Client-writable: title, description, game_name, goal_amount, goal_label
-- (host's own copy), plus status/started_at under the narrow rule below.
--
-- Only two client-role paths update this table (both in src/lib/actions/live.ts):
--   goLive()            → status 'idle'→'live' + stamps started_at
--   setStreamGameGoal() → game_name/goal_amount/goal_label
-- Every other write (create, end, Mux + LiveKit webhooks) goes through the
-- service role, which has BYPASSRLS and is unaffected by this policy.

drop policy "Hosts can update their own streams" on public.live_streams;

create policy "Hosts can update their own streams"
  on public.live_streams
  for update
  to authenticated
  using (host_id = auth.uid())
  with check (
    host_id = auth.uid()
    -- The sub-select reads the pre-UPDATE snapshot, so `o` is the OLD row
    -- (same trick as the profiles is_teacher pin in 20260709210000).
    and exists (
      select 1
      from public.live_streams o
      where o.id = live_streams.id
        -- Everything outside the allow-list must be identical.
        and (to_jsonb(o) - '{title,description,status,started_at,game_name,goal_amount,goal_label}'::text[])
          = (to_jsonb(live_streams) - '{title,description,status,started_at,game_name,goal_amount,goal_label}'::text[])
        -- status: only the goLive() transition. Ending a stream is server-side.
        and (
          live_streams.status = o.status
          or (o.status = 'idle' and live_streams.status = 'live')
        )
        -- started_at: stamped once when the stream goes live, never rewritten.
        and (
          live_streams.started_at is not distinct from o.started_at
          or o.started_at is null
        )
    )
  );
