-- Demo seed data for local development.
--
-- Profiles reference auth.users, so create the auth users first. When running
-- against a local Supabase stack you can create test users with:
--
--   supabase auth admin create-user --email demo@gwave.ai --password password123
--
-- then replace the UUIDs below with the created user ids. The upserts are
-- idempotent so this file can be re-run safely.

insert into public.profiles (id, username, full_name, bio, role)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'GWave Admin',
    'Platform administrator.',
    'super_admin'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'grower_demo',
    'Demo Grower',
    'Hydroponic hobbyist growing under LED.',
    'member'
  )
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  bio = excluded.bio,
  role = excluded.role;
