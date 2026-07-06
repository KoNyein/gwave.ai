-- Phase 5: manual currency rate table for the tools hub (and PromptPay
-- THB conversion). Publicly readable, edited by admins.

create table public.currency_rates (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  -- Units of this currency per 1 USD.
  rate_per_usd numeric(14, 4) not null check (rate_per_usd > 0),
  updated_at timestamptz not null default now()
);

create trigger currency_rates_set_updated_at
  before update on public.currency_rates
  for each row execute function public.handle_updated_at();

insert into public.currency_rates (code, rate_per_usd)
values
  ('USD', 1),
  ('THB', 36),
  ('MMK', 2100)
on conflict (code) do nothing;

alter table public.currency_rates enable row level security;

create policy "Currency rates are publicly readable"
  on public.currency_rates
  for select
  to anon, authenticated
  using (true);

create policy "Admins can manage currency rates"
  on public.currency_rates
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
