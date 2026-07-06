-- Demo seed data for local development (Phase 1 — social core).
--
-- Creates 5 demo auth users (password: password123), profiles, friendships,
-- follows, 30 posts, comments, reactions and a share. Idempotent — safe to
-- re-run. Intended for `supabase db reset` against a LOCAL stack only.

-- ---------------------------------------------------------------------------
-- Demo auth users (email/password login: demoN@gwave.ai / password123)
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  user_id::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  email,
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name),
  now(), now(), '', '', '', ''
from (
  values
    ('00000000-0000-0000-0000-000000000001', 'demo1@gwave.ai', 'Aung Myo'),
    ('00000000-0000-0000-0000-000000000002', 'demo2@gwave.ai', 'Su Nanda'),
    ('00000000-0000-0000-0000-000000000003', 'demo3@gwave.ai', 'Kyaw Zin'),
    ('00000000-0000-0000-0000-000000000004', 'demo4@gwave.ai', 'Thida Oo'),
    ('00000000-0000-0000-0000-000000000005', 'demo5@gwave.ai', 'Min Thu')
) as u(user_id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.id::text like '00000000-0000-0000-0000-00000000000%'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- ---------------------------------------------------------------------------
-- Profiles (rows already created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------

insert into public.profiles (id, username, full_name, bio, role)
values
  ('00000000-0000-0000-0000-000000000001', 'aungmyo', 'Aung Myo',
   'Hydroponic hobbyist growing under LED. Platform admin.', 'super_admin'),
  ('00000000-0000-0000-0000-000000000002', 'sunanda', 'Su Nanda',
   'Rooftop gardener in Yangon. Tomatoes and basil are my thing.', 'member'),
  ('00000000-0000-0000-0000-000000000003', 'kyawzin', 'Kyaw Zin',
   'DWC and NFT systems. Ask me about nutrient schedules.', 'user'),
  ('00000000-0000-0000-0000-000000000004', 'thidaoo', 'Thida Oo',
   'Microgreens farmer. Small space, big flavors.', 'user'),
  ('00000000-0000-0000-0000-000000000005', 'minthu', 'Min Thu',
   'Just getting started with indoor growing.', 'user')
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  bio = excluded.bio,
  role = excluded.role;

-- ---------------------------------------------------------------------------
-- Friendships & follows
-- ---------------------------------------------------------------------------

insert into public.friendships (requester_id, addressee_id, status)
values
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002', 'accepted'),
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003', 'accepted'),
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000004', 'accepted'),
  ('00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000004', 'accepted'),
  -- Pending request into user 1's inbox for testing accept/decline.
  ('00000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001', 'pending')
on conflict do nothing;

insert into public.follows (follower_id, followee_id)
values
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000005')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 30 posts (distinct created_at values so keyset pagination is exercised)
-- ---------------------------------------------------------------------------

insert into public.posts (id, author_id, content, visibility, created_at)
select
  ('a0000000-0000-0000-0000-' || lpad(t.ordinality::text, 12, '0'))::uuid,
  t.author_id::uuid,
  t.content,
  t.visibility::public.post_visibility,
  now() - (t.ordinality || ' hours')::interval
from unnest(
  array[
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005'
  ],
  array[
    'Week 6 of flower and the trichomes are stacking beautifully. LED spectrum tuning really pays off. 🌱',
    'First rooftop tomato harvest of the season! The heirloom varieties loved the compost tea.',
    'PSA: check your EC meters monthly. Mine drifted 0.3 and I was overfeeding for weeks.',
    'Microgreens rack update — sunflower shoots ready in 8 days flat. Restaurant orders are up!',
    'Day 1 of my first indoor grow. Any tips for a complete beginner?',
    'Comparing VPD targets: 1.0 kPa in veg vs 1.3 in flower. The difference in leaf posture is real.',
    'Basil propagation experiment: water cloning vs rockwool. Water wins on speed, rockwool on roots.',
    'Swapped my DWC reservoir to food-grade totes. Cheaper AND lighter. Highly recommend.',
    'Radish microgreens have the best margins, but pea shoots sell out first every single week.',
    'Bought a pH pen, an EC meter and a VPD chart. This hobby escalates quickly 😅',
    'Nutrient lockout diagnosed: cal-mag deficiency masked as nitrogen tox. Flush and reset.',
    'My balcony pepper plants survived the storm! Staking early saved the whole crop.',
    'NFT channel slope matters more than people think. 1:40 works best in my setup.',
    'Trying hemp microgreens next month. Anyone have experience with seed sourcing?',
    'Germination rate 19/20 on the new seeds. The paper towel method never fails.',
    'Built a DIY carbon filter for under $30. Smell? What smell? DM for the parts list.',
    'Companion planting update: marigolds cut my aphid problem to basically zero.',
    'Reservoir chiller season is here. Keeping res temps at 19°C stops root rot cold.',
    'Harvested 2kg of microgreens this week. Small space, decent income. AMA.',
    'Week 2 update: seedlings stretched a bit, lowered the light 10cm. Learning!',
    'Defoliation day. Lollipopped the bottom third — airflow is night and day.',
    'Pickled my surplus cherry tomatoes. Winter me will thank summer me.',
    'Switched to 12/12. Flower stretch incoming — scrog net is ready.',
    'New grow tent arrived for the microgreens overflow. Expansion time!',
    'First true leaves! Naming all five plants after my favorite singers.',
    'Terpene talk: myrcene-heavy strains need lower drying temps. 16°C, 60% RH, slow and low.',
    'Compost tea brewing guide posted to my profile. 24h aeration minimum!',
    'Root porn Friday: check these DWC roots. White as snow. 🥦',
    'Broccoli microgreens taste test: 10-day vs 12-day harvest. 10-day wins.',
    'Ordered a carbon filter and oscillating fans thanks to this community. You all rock.'
  ],
  array[
    'public','public','public','public','public',
    'friends','public','public','public','public',
    'public','friends','public','public','public',
    'public','public','public','public','friends',
    'public','public','friends','public','public',
    'public','public','public','public','public'
  ]
) with ordinality as t(author_id, content, visibility)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample engagement (counters & notifications maintained by triggers)
-- ---------------------------------------------------------------------------

insert into public.comments (id, post_id, author_id, content)
values
  ('c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'Those colas look incredible! What spectrum are you running?'),
  ('c0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000003',
   'Start simple: one plant, quality light, and a pH pen. Welcome aboard!'),
  ('c0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000004',
   'Keep a daily journal from day one. Future you will be grateful.')
on conflict (id) do nothing;

-- One nested reply (single level).
insert into public.comments (id, post_id, author_id, parent_id, content)
values
  ('c0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Full spectrum with a bump in far-red for the last two weeks!')
on conflict (id) do nothing;

insert into public.reactions (user_id, post_id, type)
values
  ('00000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001', 'love'),
  ('00000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001', 'like'),
  ('00000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001', 'wow'),
  ('00000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000002', 'like'),
  ('00000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000005', 'love'),
  ('00000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000019', 'haha')
on conflict do nothing;

-- One share (the posts trigger records it in public.shares).
insert into public.posts (id, author_id, content, visibility, shared_post_id, created_at)
values
  ('a0000000-0000-0000-0000-000000000031',
   '00000000-0000-0000-0000-000000000002',
   'This is exactly why meter calibration matters. Must-read for hydro folks.',
   'public',
   'a0000000-0000-0000-0000-000000000003',
   now() - interval '30 minutes')
on conflict (id) do nothing;
