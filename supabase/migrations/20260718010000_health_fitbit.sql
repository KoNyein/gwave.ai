-- Fitbit OAuth uses the Authorization Code flow, so we hold per-user access +
-- refresh tokens (unlike the aggregator model, which pushed data with no stored
-- token). Add the columns to health_connections. Owner-only RLS already hides
-- these rows; tokens are only ever read server-side via the service role.
--
-- Idempotent: safe to re-run (no migration ledger — files are piped into psql).

alter table public.health_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scope text,
  -- Fitbit's own user id for this connection (their `user_id`).
  add column if not exists provider_user_id text;
