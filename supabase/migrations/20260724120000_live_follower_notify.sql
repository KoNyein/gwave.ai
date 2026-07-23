-- Notify a host's followers when they go live.
--
-- Two additions:
--   1. notification_type gains 'live_started' — the in-app notification a
--      follower gets when someone they follow starts a broadcast. Both clients
--      (web notification-item, app notifications screen) already fall back
--      gracefully for unknown types, so this is safe to add ahead of them.
--   2. live_streams.followers_notified_at — a once-per-stream dedup marker so a
--      reconnect (the encoder dropping and /start firing again, or an
--      auto-ended row being restarted) never re-notifies. The server claims it
--      atomically (UPDATE ... WHERE followers_notified_at IS NULL) before fanning
--      out, so only the first go-live transition ever sends.
--
-- The fan-out itself (in-app rows + best-effort web push) runs in the request
-- path via the service role — see src/lib/live-notify.ts. Nothing here inserts
-- notifications; this migration only makes the two writes possible. The write to
-- followers_notified_at is a server-role write (BYPASSRLS), so the live_streams
-- column-lockdown policy (20260721090000) is unaffected.

alter type public.notification_type add value if not exists 'live_started';

alter table public.live_streams
  add column if not exists followers_notified_at timestamptz;
