-- Phase 8: admin + developer platform — content moderation, suspension,
-- audit logging, site settings, feature flags, hashed API keys with usage
-- logs and rate limiting, and HMAC-signed webhooks.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.report_status as enum (
  'pending',
  'removed',    -- content taken down
  'dismissed'   -- report rejected
);

create type public.webhook_event as enum (
  'post.created',
  'sale.completed',
  'alert.triggered'
);

-- ---------------------------------------------------------------------------
-- Moderation: reports + suspension
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.report_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_single_target
    check ((post_id is null) <> (comment_id is null))
);

create index reports_pending_idx
  on public.reports (created_at)
  where status = 'pending';

-- Suspension columns on profiles.
alter table public.profiles
  add column suspended_until timestamptz,
  add column suspend_reason text;

create or replace function public.is_suspended(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.suspended_until is not null
      and p.suspended_until > now()
  );
$$;

-- Suspended users cannot create new content (read stays possible).
drop policy "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_suspended(auth.uid())
    and (group_id is null or public.is_group_member(group_id))
    and (
      page_id is null
      or exists (
        select 1 from public.pages pg
        where pg.id = page_id and pg.owner_id = auth.uid()
      )
    )
    and (
      shared_post_id is null
      or (
        group_id is null
        and page_id is null
        and exists (
          select 1
          from public.posts original
          where original.id = shared_post_id
            and original.shared_post_id is null
            and public.can_view_post_id(original.id)
        )
      )
    )
  );

drop policy "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_suspended(auth.uid())
    and public.can_view_post_id(post_id)
  );

-- Moderator-or-above helper.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin', 'super_admin')
  );
$$;

alter table public.reports enable row level security;

create policy "Users can file reports"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "Reporters and moderators can read reports"
  on public.reports
  for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

create policy "Moderators can resolve reports"
  on public.reports
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- ---------------------------------------------------------------------------
-- Audit log (writes only via service role / SECURITY DEFINER paths)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "Admins read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Site settings & feature flags
-- ---------------------------------------------------------------------------

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.handle_updated_at();

insert into public.site_settings (key, value)
values ('general', '{"site_name": "gwave.ai"}')
on conflict (key) do nothing;

alter table public.site_settings enable row level security;

create policy "Settings are publicly readable"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

create policy "Admins manage settings"
  on public.site_settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_.-]{2,60}$'),
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.handle_updated_at();

create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('developer', 'admin', 'super_admin')
  );
$$;

alter table public.feature_flags enable row level security;

create policy "Flags are publicly readable"
  on public.feature_flags
  for select
  to anon, authenticated
  using (true);

create policy "Developers manage flags"
  on public.feature_flags
  for all
  to authenticated
  using (public.is_developer())
  with check (public.is_developer());

-- ---------------------------------------------------------------------------
-- API keys, usage logs, webhooks
-- ---------------------------------------------------------------------------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- The full key is shown once; only its SHA-256 hex digest is stored.
  prefix text not null unique,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  rate_limit integer not null default 60
    check (rate_limit between 1 and 10000), -- requests/minute
  last_used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index api_keys_owner_idx on public.api_keys (owner_id);

alter table public.api_keys enable row level security;

create policy "Developers manage their own API keys"
  on public.api_keys
  for all
  to authenticated
  using (owner_id = auth.uid() and public.is_developer())
  with check (owner_id = auth.uid() and public.is_developer());

create table public.api_logs (
  id bigint generated always as identity primary key,
  api_key_id uuid not null references public.api_keys (id) on delete cascade,
  endpoint text not null,
  method text not null,
  status integer not null,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index api_logs_created_brin on public.api_logs using brin (created_at);
create index api_logs_key_idx on public.api_logs (api_key_id, created_at desc);

alter table public.api_logs enable row level security;

create policy "Owners read their API logs"
  on public.api_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.api_keys k
      where k.id = api_key_id and k.owner_id = auth.uid()
    )
  );

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  events public.webhook_event[] not null default '{}',
  -- HMAC-SHA256 signing secret, shown to the owner (they need it to verify).
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index webhooks_owner_idx on public.webhooks (owner_id);

alter table public.webhooks enable row level security;

create policy "Developers manage their own webhooks"
  on public.webhooks
  for all
  to authenticated
  using (owner_id = auth.uid() and public.is_developer())
  with check (owner_id = auth.uid() and public.is_developer());

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks (id) on delete cascade,
  event public.webhook_event not null,
  payload jsonb not null,
  attempts integer not null default 0,
  last_status integer,
  delivered_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index webhook_deliveries_due_idx
  on public.webhook_deliveries (next_attempt_at)
  where delivered_at is null;

alter table public.webhook_deliveries enable row level security;

create policy "Owners read their webhook deliveries"
  on public.webhook_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.webhooks w
      where w.id = webhook_id and w.owner_id = auth.uid()
    )
  );

-- Enqueue deliveries for subscribed webhooks (SECURITY DEFINER).
create or replace function public.enqueue_webhook(
  p_event public.webhook_event,
  p_owner uuid,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.webhook_deliveries (webhook_id, event, payload)
  select w.id, p_event, p_payload
  from public.webhooks w
  where w.active
    and w.owner_id = p_owner
    and p_event = any (w.events);
$$;

-- post.created → the post author's webhooks.
create or replace function public.webhook_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_webhook(
    'post.created',
    new.author_id,
    jsonb_build_object(
      'event', 'post.created',
      'post_id', new.id,
      'author_id', new.author_id,
      'visibility', new.visibility,
      'created_at', new.created_at
    )
  );
  return null;
end;
$$;

create trigger posts_webhook
  after insert on public.posts
  for each row execute function public.webhook_on_post();

-- sale.completed → the store owner's webhooks.
create or replace function public.webhook_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.stores where id = new.store_id;
  if v_owner is not null then
    perform public.enqueue_webhook(
      'sale.completed',
      v_owner,
      jsonb_build_object(
        'event', 'sale.completed',
        'sale_id', new.id,
        'store_id', new.store_id,
        'receipt_number', new.receipt_number,
        'total', new.total,
        'created_at', new.created_at
      )
    );
  end if;
  return null;
end;
$$;

create trigger sales_webhook
  after insert on public.sales
  for each row execute function public.webhook_on_sale();

-- alert.triggered → the alert owner's webhooks.
create or replace function public.webhook_on_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_webhook(
    'alert.triggered',
    new.owner_id,
    jsonb_build_object(
      'event', 'alert.triggered',
      'alert_id', new.id,
      'device_id', new.device_id,
      'severity', new.severity,
      'message', new.message,
      'created_at', new.created_at
    )
  );
  return null;
end;
$$;

create trigger alerts_webhook
  after insert on public.alerts
  for each row execute function public.webhook_on_alert();
