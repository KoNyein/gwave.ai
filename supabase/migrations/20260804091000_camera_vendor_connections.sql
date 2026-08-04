-- Vendor-cloud camera account linking: connection metadata, sealed secrets,
-- and the vendor columns on user_cameras.
-- (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §7, PR 1.)
--
-- Design rules enforced here:
--   * Metadata the owner may see lives in camera_vendor_connections (no
--     tokens, ever).
--   * Tokens live in camera_vendor_secrets — RLS enabled with NO policies and
--     all client-role grants revoked, so only the service role (BYPASSRLS)
--     can touch it. On top of that the token values are AES-256-GCM
--     ciphertext; the key stays in /etc/gwave-web.env
--     (CAMERA_VENDOR_TOKEN_KEY_V1), so even a full DB leak does not leak
--     usable vendor tokens.
--   * `provider` is text, not an enum — adding a provider must not need a
--     migration (the TypeScript registry is the source of truth).
--   * All client-side writes go through server routes; browsers can only
--     READ their own connection metadata.

-- ── Connection metadata (owner-visible, secret-free) ────────────────────────

create table public.camera_vendor_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  provider_account_id text
    check (provider_account_id is null or char_length(provider_account_id) <= 200),
  account_label text
    check (account_label is null or char_length(account_label) <= 120),
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked', 'error', 'disconnected')),
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  token_expires_at timestamptz,
  last_success_at timestamptz,
  last_error_code text
    check (last_error_code is null or char_length(last_error_code) <= 60),
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create index camera_vendor_connections_user_idx
  on public.camera_vendor_connections (user_id, created_at desc);

create trigger camera_vendor_connections_set_updated_at
  before update on public.camera_vendor_connections
  for each row execute function public.handle_updated_at();

alter table public.camera_vendor_connections enable row level security;

-- Owners may READ their own connection metadata (the token columns simply do
-- not exist here). All writes — connect, refresh, error, disconnect — happen
-- through server routes using the service role, so there are deliberately no
-- insert/update/delete policies.
create policy "Owners read their own vendor connections"
  on public.camera_vendor_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

-- The default privileges from 20260717000000_grant_api_roles hand INSERT/
-- UPDATE/DELETE to `authenticated` and SELECT to `anon` on every new table.
-- RLS already denies them (no policies), but revoke anyway so a future
-- permissive policy cannot silently open a write path.
revoke insert, update, delete on public.camera_vendor_connections from authenticated;
revoke all on public.camera_vendor_connections from anon;

-- ── Secrets (service-role only, application-encrypted) ──────────────────────

create table public.camera_vendor_secrets (
  connection_id uuid primary key
    references public.camera_vendor_connections (id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_nonce text not null,
  token_auth_tag text not null,
  key_version integer not null default 1 check (key_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger camera_vendor_secrets_set_updated_at
  before update on public.camera_vendor_secrets
  for each row execute function public.handle_updated_at();

-- Sealed: RLS on, zero policies, zero client grants. Only the service role
-- (BYPASSRLS) reads or writes this table. There is intentionally no
-- owner-read policy — the browser never needs a vendor token.
alter table public.camera_vendor_secrets enable row level security;
revoke all on public.camera_vendor_secrets from anon, authenticated;

-- ── user_cameras: vendor reference columns ──────────────────────────────────

alter table public.user_cameras
  add column if not exists vendor_connection_id uuid
    references public.camera_vendor_connections (id) on delete set null,
  add column if not exists vendor_camera_id text
    check (vendor_camera_id is null or char_length(vendor_camera_id) <= 200),
  add column if not exists vendor_provider text
    check (vendor_provider is null or vendor_provider ~ '^[a-z0-9_-]{2,40}$'),
  add column if not exists vendor_display_model text
    check (vendor_display_model is null or char_length(vendor_display_model) <= 120),
  add column if not exists vendor_capabilities jsonb,
  add column if not exists vendor_metadata jsonb,
  add column if not exists vendor_last_seen_at timestamptz;

comment on column public.user_cameras.vendor_connection_id is
  'Vendor-cloud cameras: the camera_vendor_connections row this import came from. NULL for webrtc/rtsp/kvs cameras.';
comment on column public.user_cameras.vendor_camera_id is
  'The camera''s id in the vendor cloud. A reference, never a credential.';
comment on column public.user_cameras.vendor_capabilities is
  'Normalized feature flags (liveView/snapshot/ptz/...). Sanitized server-side.';
comment on column public.user_cameras.vendor_metadata is
  'Safe vendor metadata only — sanitized server-side, never credentials or stream URLs.';

-- A vendor_cloud camera must carry its vendor reference; other camera types
-- must not. ('vendor_cloud' is usable here because the enum value was added
-- in the previous migration file = a committed transaction.)
alter table public.user_cameras
  add constraint camera_vendor_cloud_fields check (
    (
      camera_type <> 'vendor_cloud'
      and vendor_connection_id is null
      and vendor_camera_id is null
      and vendor_provider is null
    )
    or (
      camera_type = 'vendor_cloud'
      and vendor_connection_id is not null
      and vendor_camera_id is not null
      and vendor_provider is not null
      -- A vendor camera streams via short-lived sessions, never a stored URL.
      and rtsp_url is null
    )
  );

-- One vendor camera imports at most once per connection.
create unique index user_cameras_vendor_unique
  on public.user_cameras (vendor_connection_id, vendor_camera_id)
  where vendor_connection_id is not null;

-- ── Feature flag (default OFF) ──────────────────────────────────────────────

insert into public.feature_flags (key, enabled, description)
values (
  'cctv_vendor_cloud',
  false,
  'Vendor-cloud camera account linking (Hikvision etc.). Stage-gated rollout; see docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md.'
)
on conflict (key) do nothing;
