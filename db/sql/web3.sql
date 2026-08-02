-- Gwave Web3 — mint queue lifecycle (W3) + on-chain event mirror (W4)
--
-- Apply:
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   docker run --rm -e PGPASSWORD="$DBPASS" -i postgres:16 \
--     psql -h <rds-host> -U gwaveadmin -d gwave -v ON_ERROR_STOP=1 < web3.sql
--   sudo docker restart postgrest
--
-- ★ ဒီ file က idempotent — ထပ်ခါထပ်ခါ run လို့ရတယ်။
-- ★ RLS က sealed (policy မထားဘဲ ဖွင့်ထား) — service_role သာ ဖတ်/ရေးလို့ရတယ်။
--   ဒီ table တွေထဲမှာ minter ရဲ့ လုပ်ဆောင်ချက်မှတ်တမ်း ရှိလို့ browser ကနေ
--   တိုက်ရိုက် ဖတ်ခွင့် လုံးဝမပေးရဘူး။

begin;

-- ── W3 · Mint queue ─────────────────────────────────────────────────────────
-- ★ ဘာလို့ queue လိုလဲ — mint က ၂-၆ စက္ကန့်ကြာပြီး ကျရှုံးနိုင်တယ်။ HTTP
--   request ထဲမှာ တန်းလုပ်ရင် user က စောင့်ရပြီး၊ fail ရင် ဘာမှ မကျန်ဘူး။
--   Queue ထဲထည့်ထားရင် worker က ပြန်ကြိုးစားလို့ရတယ်။
-- ★ status က ၅ ခု —
--     pending    ခင်းထားပြီ၊ မပို့ရသေး
--     sent       chain ဆီ ပို့ပြီး — ★ **အောင်မြင်ပြီ မဟုတ်သေးဘူး**
--     confirmed  block ထဲ ဝင်ပြီး confirmation ၃ ခု ရပြီ
--     failed     ပြန်ကြိုးစားလို့ မရတော့ဘူး (admin ကြည့်ရမယ်)
--     cancelled  လူက ရပ်လိုက်တာ
create table if not exists public.mv_mint_queue (
  id            bigserial primary key,
  user_id       uuid references public.profiles (id) on delete set null,
  wallet        text not null,                 -- ★ အမြဲ lowercase
  kind          text not null,                 -- 'land' | 'item'
  token_id      bigint,                        -- land: plot id, item: sku id
  amount        integer not null default 1,
  status        text not null default 'pending',
  tx_hash       text,
  block_number  bigint,
  confirmed_at  timestamptz,
  nonce         integer,
  attempts      integer not null default 0,
  last_error    text,
  -- ★ Idempotency — API က တစ်ခုတည်းသော key နဲ့ ထည့်ရင် user က ခလုတ်ကို
  --   ၂ ခါနှိပ်လည်း job ၂ ခု မဖြစ်ဘူး။
  idem_key      text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint mv_mint_queue_status_chk
    check (status in ('pending', 'sent', 'confirmed', 'failed', 'cancelled')),
  constraint mv_mint_queue_kind_chk check (kind in ('land', 'item'))
);

-- Worker က pending/sent ကိုသာ ဆွဲထုတ်တယ် — status နဲ့ created_at အစဉ်လိုက်။
create index if not exists mv_mint_queue_work_idx
  on public.mv_mint_queue (status, created_at)
  where status in ('pending', 'sent');

create index if not exists mv_mint_queue_wallet_idx
  on public.mv_mint_queue (wallet);

-- ★ tx_hash က unique ဖြစ်ရမယ် — replace လုပ်တဲ့အခါ hash အသစ်ရတယ်၊
--   ဒါပေမယ့် hash တစ်ခုတည်းကို job ၂ ခုမှာ မှတ်မိလို့ မရရ။
create unique index if not exists mv_mint_queue_tx_idx
  on public.mv_mint_queue (tx_hash) where tx_hash is not null;

-- ရှိပြီးသား table အတွက် ဖြည့်စွက် (spec W3.2)
alter table public.mv_mint_queue add column if not exists block_number bigint;
alter table public.mv_mint_queue add column if not exists confirmed_at timestamptz;
alter table public.mv_mint_queue add column if not exists nonce integer;

-- ── W4 · NFT ပိုင်ရှင် mirror (ERC-721) ─────────────────────────────────────
-- ★ ဘာလို့ mirror လုပ်ရလဲ — `getOwnedPlots()` က RPC ကို တိုက်ရိုက်မေးရင်
--   user ၁၀၀ ဝင်ရင် RPC call ၁၀၀ ဖြစ်ပြီး quota ကုန်တယ်။ DB ကနေဖြေရင်
--   millisecond နဲ့ ပြီးတယ်။
create table if not exists public.web3_nft_owners (
  contract     text not null,                  -- ★ lowercase
  token_id     bigint not null,
  owner        text not null,                  -- ★ lowercase
  block_number bigint not null,
  updated_at   timestamptz not null default now(),
  primary key (contract, token_id)
);

create index if not exists web3_nft_owners_owner_idx
  on public.web3_nft_owners (owner);

-- ── W4 · ERC-1155 လက်ကျန် ─────────────────────────────────────────────────
create table if not exists public.web3_balances (
  contract   text not null,
  token_id   bigint not null,
  owner      text not null,                    -- ★ lowercase
  balance    bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (contract, token_id, owner)
);

-- ★ partial index — balance 0 row တွေက burn/transfer ပြီးတာတွေ၊ များတယ်။
--   ပိုင်ဆိုင်မှုရှာတဲ့အခါ အဲဒါတွေကို လုံးဝ မကြည့်ဘူး။
create index if not exists web3_balances_owner_idx
  on public.web3_balances (owner) where balance > 0;

-- ── W4 · ဘယ် block အထိ ဖတ်ပြီးပြီလဲ ────────────────────────────────────────
-- ★ ဒါမရှိရင် indexer restart တိုင်း block 0 ကနေ ပြန်ဖတ်ပြီး RPC quota
--   တစ်မိနစ်အတွင်း ကုန်မယ်။
create table if not exists public.web3_sync_state (
  contract   text primary key,
  last_block bigint not null,
  updated_at timestamptz not null default now()
);

-- ── RLS — sealed ───────────────────────────────────────────────────────────
alter table public.mv_mint_queue    enable row level security;
alter table public.web3_nft_owners  enable row level security;
alter table public.web3_balances    enable row level security;
alter table public.web3_sync_state  enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on
      public.mv_mint_queue, public.web3_nft_owners,
      public.web3_balances, public.web3_sync_state
      to service_role;
    grant usage, select on sequence public.mv_mint_queue_id_seq to service_role;
  end if;
end $$;

commit;
