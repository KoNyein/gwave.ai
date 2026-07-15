-- Cognito (Supabase Third-Party Auth) migration.
--
-- With third-party auth, users live in the Amazon Cognito User Pool, not in
-- Supabase's auth.users table. The profiles.id → auth.users(id) foreign key can
-- therefore no longer be satisfied, so drop it. profiles.id stays the primary
-- key and still equals the authenticated user id (the Cognito token's `sub`,
-- which auth.uid() returns), so every RLS policy keying on auth.uid() = id keeps
-- working unchanged.
--
-- The handle_new_user() trigger fired on auth.users inserts; with Cognito there
-- are no such inserts, so profile rows are provisioned by the app on first
-- sign-in instead. The trigger/function are left in place (harmless) so that a
-- rollback to Supabase Auth needs no further change.
--
-- Safe to apply while still on Supabase Auth: dropping the FK only removes a
-- referential check the app already enforces (it always writes id = the
-- authenticated user's id).

alter table public.profiles
  drop constraint if exists profiles_id_fkey;
