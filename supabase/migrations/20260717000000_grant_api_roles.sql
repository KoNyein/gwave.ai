-- Self-hosted parity: grant the PostgREST API roles (anon, authenticated,
-- service_role) access to the public schema. Supabase Cloud sets these up in
-- its base image, but a bare Postgres (this deployment's AWS RDS) does not, so
-- tables added after the initial setup (e.g. ptt_channels, the SOS tables) were
-- reachable by RLS policy but still raised "permission denied for table" because
-- the role held no table-level GRANT. Row Level Security remains the real gate —
-- these grants only let the roles reach the tables so RLS can then decide.
--
-- Idempotent: GRANT/ALTER DEFAULT PRIVILEGES can be re-run safely.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;
grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Cover tables/sequences/functions created by future migrations too.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
