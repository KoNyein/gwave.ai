-- ═══════════════════════════════════════════════════════════════════════
-- 3D Face/Body Scan Avatar System — Phase 1 schema
-- (GWAVE_METAVERSE_AVATAR_SPEC.md §7, adapted to Gwave's schema)
--
-- Run on EC2 (the Claude container cannot reach RDS):
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h <rds-host> -U gwaveadmin -d gwave -f - < avatar-scan-phase1.sql
--   sudo docker restart postgrest        # DDL → schema cache refresh
--
-- Adaptations from the spec:
--   · users(id)  → profiles(id)  (Gwave's account table)
--   · house convention: RLS sealed, service_role grants only — the app
--     reads/writes through the admin client, never through anon.
-- ═══════════════════════════════════════════════════════════════════════

-- Per-user scan-avatar config. Separate from mv_players.avatar_config
-- (the procedural customiser) so the two systems can coexist while the
-- scan pipeline rolls out phase by phase.
create table if not exists mv_scan_avatars (
  user_id        uuid primary key references profiles(id) on delete cascade,
  face_glb_url   text,                          -- scanned head GLB (S3/CDN)
  face_thumb_url text,
  body_type      text not null default 'm' check (body_type in ('m', 'f')),
  morphs         jsonb not null default '{}',   -- {height:0.2, waist:-0.1, ...}
  skin_color     text not null default '#c99e7f'
                 check (skin_color ~ '^#[0-9a-fA-F]{6}$'),
  hair_id        text,
  hair_color     text check (hair_color is null or hair_color ~ '^#[0-9a-fA-F]{6}$'),
  outfit_id      text not null default 'casual_01',
  accessories    jsonb not null default '[]',
  scan_source    text not null default 'none'
                 check (scan_source in ('none', 'face', 'face+body')),
  -- biometric consent (spec §10) — must be set before any scan upload
  consented_at   timestamptz,
  version        int not null default 1,        -- bump busts room-side caches
  updated_at     timestamptz not null default now()
);

-- Skins / hair / outfits library (defaults now, marketplace later)
create table if not exists avatar_assets (
  id         text primary key,                  -- 'outfit_casual_01'
  kind       text not null check (kind in ('outfit', 'hair', 'body', 'accessory')),
  name       text not null,
  glb_url    text not null,
  thumb_url  text,
  is_default boolean not null default false,
  price      int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists avatar_inventory (
  user_id     uuid references profiles(id) on delete cascade,
  asset_id    text references avatar_assets(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

-- Sealed RLS + service_role only (house convention)
alter table mv_scan_avatars enable row level security;
alter table avatar_assets   enable row level security;
alter table avatar_inventory enable row level security;
revoke all on mv_scan_avatars, avatar_assets, avatar_inventory from anon, authenticated;
grant select, insert, update, delete
  on mv_scan_avatars, avatar_assets, avatar_inventory to service_role;

-- Default library seeds — kit-character placeholder bodies (Phase 1).
-- glb_url points at files already shipped in public/ so nothing new
-- needs uploading; real authored bodies replace these rows later.
insert into avatar_assets (id, kind, name, glb_url, is_default) values
  ('body_kit_a', 'body', 'Scout',   '/metaverse/kits/characters/character-a.glb', true),
  ('body_kit_b', 'body', 'Ranger',  '/metaverse/kits/characters/character-b.glb', true),
  ('body_kit_c', 'body', 'Urban',   '/metaverse/kits/characters/character-c.glb', true),
  ('body_kit_d', 'body', 'Casual',  '/metaverse/kits/characters/character-d.glb', true),
  ('body_kit_e', 'body', 'Worker',  '/metaverse/kits/characters/character-e.glb', true),
  ('body_kit_f', 'body', 'Summer',  '/metaverse/kits/characters/character-f.glb', true),
  ('body_kit_g', 'body', 'Formal',  '/metaverse/kits/characters/character-g.glb', true),
  ('body_kit_h', 'body', 'Sport',   '/metaverse/kits/characters/character-h.glb', true)
on conflict (id) do nothing;

-- Verification
select 'mv_scan_avatars' as t, count(*) from mv_scan_avatars
union all select 'avatar_assets', count(*) from avatar_assets
union all select 'avatar_inventory', count(*) from avatar_inventory;
