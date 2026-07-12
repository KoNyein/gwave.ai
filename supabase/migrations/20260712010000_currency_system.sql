-- ============================================================================
-- Currency system — ISO 4217 fiat + crypto assets, built to an international
-- standard so banking / FX / crypto providers can be plugged in later.
--
-- Peg: 1 G-Pay = 1 MMK (Myanmar Kyat), fixed. The wallet's `balance` is
-- always denominated in MMK; other currencies are derived from the rate
-- table (units per 1 USD) via a USD cross-rate. Rates stay admin-editable;
-- a live FX/crypto feed can later write the same rows.
-- ============================================================================

-- Relax the code check so 4–6 char crypto tickers (USDT, ...) are allowed.
alter table public.currency_rates
  drop constraint if exists currency_rates_code_check;
alter table public.currency_rates
  add constraint currency_rates_code_check check (code ~ '^[A-Z]{3,6}$');

-- Widen the rate precision: crypto per-USD rates need many decimals
-- (e.g. 1 USD ≈ 0.0000105 BTC), which numeric(14,4) truncated to 0.
alter table public.currency_rates
  alter column rate_per_usd type numeric(28, 12);

-- ISO 4217 / asset metadata columns.
alter table public.currency_rates
  add column if not exists name text,
  add column if not exists symbol text,
  add column if not exists kind text not null default 'fiat'
    check (kind in ('fiat', 'crypto')),
  add column if not exists decimals int not null default 2
    check (decimals between 0 and 8),
  add column if not exists flag text,
  add column if not exists is_active boolean not null default true;

-- Seed a broad set. `rate_per_usd` = units of this asset per 1 USD.
-- On conflict we refresh metadata but PRESERVE existing rates (admins /
-- a feed own those), so re-running never clobbers a tuned rate.
insert into public.currency_rates
  (code, rate_per_usd, name, symbol, kind, decimals, flag)
values
  ('USD', 1,          'US Dollar',         '$',   'fiat',   2, '🇺🇸'),
  ('MMK', 4500,       'Myanmar Kyat',      'Ks',  'fiat',   0, '🇲🇲'),
  ('THB', 36,         'Thai Baht',         '฿',   'fiat',   2, '🇹🇭'),
  ('EUR', 0.92,       'Euro',              '€',   'fiat',   2, '🇪🇺'),
  ('GBP', 0.79,       'British Pound',     '£',   'fiat',   2, '🇬🇧'),
  ('SGD', 1.35,       'Singapore Dollar',  'S$',  'fiat',   2, '🇸🇬'),
  ('CNY', 7.2,        'Chinese Yuan',      '¥',   'fiat',   2, '🇨🇳'),
  ('JPY', 157,        'Japanese Yen',      '¥',   'fiat',   0, '🇯🇵'),
  ('INR', 83,         'Indian Rupee',      '₹',   'fiat',   2, '🇮🇳'),
  ('MYR', 4.7,        'Malaysian Ringgit', 'RM',  'fiat',   2, '🇲🇾'),
  ('KRW', 1350,       'South Korean Won',  '₩',   'fiat',   0, '🇰🇷'),
  ('AUD', 1.5,        'Australian Dollar', 'A$',  'fiat',   2, '🇦🇺'),
  ('BTC', 0.0000105,  'Bitcoin',           '₿',   'crypto', 8, '🪙'),
  ('ETH', 0.00028,    'Ethereum',          'Ξ',   'crypto', 8, '🪙'),
  ('USDT', 1,         'Tether USD',        '₮',   'crypto', 6, '🪙'),
  ('BNB', 0.0016,     'BNB',               'BNB', 'crypto', 8, '🪙')
on conflict (code) do update set
  name = excluded.name,
  symbol = excluded.symbol,
  kind = excluded.kind,
  decimals = excluded.decimals,
  flag = excluded.flag;

-- Backfill any pre-existing rows that predate the metadata columns.
update public.currency_rates set name = code where name is null;
update public.currency_rates set symbol = code where symbol is null;

-- ---------------------------------------------------------------------------
-- In-database conversion engine. ACID by virtue of Postgres, callable from
-- SQL/PostgREST as a microservice would be. Converts `amount` of `from_code`
-- into `to_code` via the USD cross-rate; 1 G-Pay = 1 MMK, so passing 'MMK'
-- on either side converts to/from the wallet unit. Returns null for unknown
-- or inactive codes.
-- ---------------------------------------------------------------------------
create or replace function public.gpay_convert(
  amount numeric,
  from_code text,
  to_code text
)
returns numeric
language sql
stable
as $$
  select round(
    (amount
      / (select rate_per_usd from public.currency_rates
         where code = upper(from_code) and is_active))
      * (select rate_per_usd from public.currency_rates
         where code = upper(to_code) and is_active),
    8
  );
$$;

grant execute on function public.gpay_convert(numeric, text, text)
  to anon, authenticated;

-- Convenience wrappers around the fixed 1 G-Pay = 1 MMK peg.
create or replace function public.gpay_to_currency(gpay numeric, to_code text)
returns numeric language sql stable as $$
  select public.gpay_convert(gpay, 'MMK', to_code);
$$;

create or replace function public.currency_to_gpay(amount numeric, from_code text)
returns numeric language sql stable as $$
  select public.gpay_convert(amount, from_code, 'MMK');
$$;

grant execute on function public.gpay_to_currency(numeric, text) to anon, authenticated;
grant execute on function public.currency_to_gpay(numeric, text) to anon, authenticated;
