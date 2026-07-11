-- Web Push subscriptions for PWA/TWA notifications. Each row is one
-- browser/device endpoint a user opted in from. The server (service role)
-- reads all rows to fan out a push; users manage only their own.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users can see, add and remove their own device subscriptions. The push
-- sender uses the service role (bypasses RLS) to read every recipient's rows.
create policy "own push subscriptions read" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "own push subscription insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "own push subscription delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
