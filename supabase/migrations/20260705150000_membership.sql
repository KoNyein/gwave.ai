-- Phase 4: membership — plans, subscriptions, payments and invoices with
-- Stripe + PromptPay providers, member role sync, and a members-only post
-- visibility level.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.subscription_status as enum (
  'pending',    -- awaiting payment confirmation (PromptPay slip review)
  'active',
  'past_due',
  'canceled',
  'expired'
);

create type public.payment_provider as enum ('stripe', 'promptpay', 'manual');

create type public.payment_status as enum (
  'awaiting_review', -- PromptPay slip uploaded, admin has not reviewed yet
  'pending',
  'succeeded',
  'failed',
  'rejected',
  'refunded'
);

-- Posts gain a members-only audience. The value is referenced as ::text in
-- functions below so it can be added and used in the same migration.
alter type public.post_visibility add value if not exists 'members';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.membership_plans (
  id text primary key, -- 'free' | 'pro' | 'business'
  name text not null,
  description text,
  price_monthly numeric(10, 2) not null default 0,
  currency text not null default 'USD',
  features jsonb not null default '{}',
  stripe_price_id text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger membership_plans_set_updated_at
  before update on public.membership_plans
  for each row execute function public.handle_updated_at();

insert into public.membership_plans
  (id, name, description, price_monthly, currency, features, sort_order)
values
  (
    'free', 'Free', 'The essentials for every grower.',
    0, 'USD',
    '{"member_badge": false, "member_only_posts": false, "advanced_tools": false, "max_groups": 10}',
    0
  ),
  (
    'pro', 'Pro', 'For serious growers — member badge, member-only content and advanced tools.',
    9.99, 'USD',
    '{"member_badge": true, "member_only_posts": true, "advanced_tools": true, "max_groups": 100}',
    1
  ),
  (
    'business', 'Business', 'For shops and teams — everything in Pro plus priority support.',
    29.99, 'USD',
    '{"member_badge": true, "member_only_posts": true, "advanced_tools": true, "max_groups": 1000, "priority_support": true}',
    2
  )
on conflict (id) do nothing;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.membership_plans (id),
  status public.subscription_status not null default 'pending',
  provider public.payment_provider not null,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A user has at most one live subscription at a time.
create unique index subscriptions_one_live_per_user
  on public.subscriptions (user_id)
  where status in ('pending', 'active', 'past_due');
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_status_idx on public.subscriptions (status);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider public.payment_provider not null,
  status public.payment_status not null default 'pending',
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  -- PromptPay: uploaded transfer slip in the private "slips" bucket.
  slip_path text,
  stripe_payment_id text,
  note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_review_queue_idx
  on public.payments (created_at)
  where status = 'awaiting_review';

create sequence public.invoice_number_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  description text,
  issued_at timestamptz not null default now()
);

create index invoices_user_idx on public.invoices (user_id, issued_at desc);

-- ---------------------------------------------------------------------------
-- Helpers & triggers
-- ---------------------------------------------------------------------------

-- Any role above 'user' counts as a member for content gating.
create or replace function public.is_member_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role <> 'user'
  );
$$;

-- Extend the Phase 1 visibility check with the new members level.
-- Enum values are compared as text so the value added above is usable here.
create or replace function public.can_view_post(
  post_author uuid,
  post_vis public.post_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    post_author = auth.uid()
    or post_vis::text = 'public'
    or (post_vis::text = 'friends'
        and public.are_friends(auth.uid(), post_author))
    or (post_vis::text = 'members'
        and public.is_member_user(auth.uid()));
$$;

-- Keep profiles.role in sync with subscription status: activating a
-- subscription promotes 'user' → 'member'; ending the last live one demotes
-- 'member' → 'user'. Higher roles are never touched.
create or replace function public.sync_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.profiles
    set role = 'member'
    where id = new.user_id and role = 'user';
  elsif new.status in ('canceled', 'expired')
        and (tg_op = 'INSERT' or old.status <> new.status) then
    if not exists (
      select 1 from public.subscriptions s
      where s.user_id = new.user_id
        and s.status = 'active'
        and s.id <> new.id
    ) then
      update public.profiles
      set role = 'user'
      where id = new.user_id and role = 'member';
    end if;
  end if;
  return null;
end;
$$;

create trigger subscriptions_sync_role
  after insert or update on public.subscriptions
  for each row execute function public.sync_membership_role();

-- Issue an invoice whenever a payment succeeds.
create or replace function public.issue_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'succeeded'
     and (tg_op = 'INSERT' or old.status <> 'succeeded') then
    insert into public.invoices
      (number, user_id, payment_id, amount, currency, description)
    values (
      'INV-' || to_char(now(), 'YYYY') || '-'
        || lpad(nextval('public.invoice_number_seq')::text, 6, '0'),
      new.user_id,
      new.id,
      new.amount,
      new.currency,
      initcap(new.provider::text) || ' membership payment'
    );
  end if;
  return null;
end;
$$;

create trigger payments_issue_invoice
  after insert or update on public.payments
  for each row execute function public.issue_invoice();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.membership_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;

-- Plans: public pricing page; admins manage.
create policy "Plans are publicly readable"
  on public.membership_plans
  for select
  to anon, authenticated
  using (true);

create policy "Admins can manage plans"
  on public.membership_plans
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Subscriptions: users see their own; admins see and manage all. Users may
-- only create their own *pending PromptPay* subscription — Stripe rows are
-- written by the webhook via the service role, and activation is admin/
-- webhook territory.
create policy "Users see their own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can start a pending PromptPay subscription"
  on public.subscriptions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and provider = 'promptpay'
  );

create policy "Admins can manage subscriptions"
  on public.subscriptions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete subscriptions"
  on public.subscriptions
  for delete
  to authenticated
  using (public.is_admin());

-- Payments: users see their own and may submit PromptPay slips for review;
-- admins review.
create policy "Users see their own payments"
  on public.payments
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can submit PromptPay payments"
  on public.payments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and provider = 'promptpay'
    and status = 'awaiting_review'
  );

create policy "Admins can review payments"
  on public.payments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Invoices: recipient + admins (rows are created by trigger only).
create policy "Users see their own invoices"
  on public.invoices
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Private "slips" bucket for PromptPay transfer slips: owners upload/read
-- their own files, admins can read everything for review.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;

do $$
begin
  create policy "Users can upload their own slips"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'slips'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "Owners and admins can read slips"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'slips'
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_admin()
      )
    );
exception
  when insufficient_privilege then
    raise notice 'Skipped storage.objects slip policies (insufficient privilege); create them via the dashboard.';
end;
$$;
