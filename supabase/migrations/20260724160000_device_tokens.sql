-- Native push (FCM) device tokens — lets the server ring a phone whose app is
-- fully closed (the realtime ring inbox is dead then). One row per device
-- token; a token always maps to its current owner. Owner-only RLS; writes go
-- through /api/mobile/push/register (service role) but direct access is scoped.

create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;
drop policy if exists device_tokens_own on public.device_tokens;
create policy device_tokens_own on public.device_tokens
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.device_tokens to authenticated;
