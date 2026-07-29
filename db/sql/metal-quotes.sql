-- Metal quotes — the market log (ဈေးမှတ်တမ်း) behind gwave.cc/metals.
--
-- For metals no free feed can price: antimony (ခနောက်စိမ်း), ore grades, and
-- local markets like the Muse border, where the price is whatever the brokers
-- are actually paying that week. An admin records a quote with its market and
-- date; the board shows it clearly labelled as a manual record, never mixed
-- into the live exchange rows.
--
-- RLS is enabled with NO policies on purpose: the table is invisible through
-- PostgREST entirely. Every read and write goes through /api/metals* on the
-- server, which checks the caller's role itself — one gate, in one place.
--
-- Run in dockerised psql, then: sudo docker restart postgrest

create table if not exists public.metal_quotes (
  id          uuid primary key default gen_random_uuid(),
  metal_key   text not null check (char_length(metal_key) between 1 and 40),
  name_my     text not null check (char_length(name_my) between 1 and 80),
  grade       text check (grade is null or char_length(grade) <= 80),
  price       numeric(14, 2) not null check (price > 0),
  currency    text not null check (char_length(currency) between 2 and 8),
  unit        text not null check (char_length(unit) between 1 and 20),
  market      text not null check (char_length(market) between 1 and 80),
  note        text check (note is null or char_length(note) <= 300),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  quoted_at   date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists metal_quotes_latest_idx
  on public.metal_quotes (metal_key, market, quoted_at desc, created_at desc);

alter table public.metal_quotes enable row level security;

select 'metal-quotes: done' as status;
