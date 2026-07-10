-- Business finance: a simple expense manager for shop/operation running costs
-- — staff salaries, shop rent, utility/meter bills, taxes and anything else.
-- Each row is one expense the owner tracks and marks paid. Owner-scoped: a
-- member sees and manages only their own expenses.

create type public.expense_category as enum (
  'salary', 'rent', 'utility', 'tax', 'other'
);

create table public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category public.expense_category not null default 'other',
  title text not null check (char_length(title) between 1 and 160),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'MMK' check (char_length(currency) between 2 and 8),
  due_date date,
  is_paid boolean not null default false,
  paid_at timestamptz,
  -- A recurring monthly cost (rent, salary, meter) vs a one-off.
  recurring boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_expenses_owner_idx
  on public.business_expenses (owner_id, due_date, created_at desc);

create trigger business_expenses_set_updated_at
  before update on public.business_expenses
  for each row execute function public.handle_updated_at();

alter table public.business_expenses enable row level security;

-- Owner-only: full control over your own expenses, nothing of anyone else's.
create policy "Owners manage their own expenses"
  on public.business_expenses
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
