-- Gwave Metaverse — persistence (Phase 4)
--
-- RDS မှာ run ရန်:
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h <rds-host> -U gwaveadmin -d postgres -v ON_ERROR_STOP=1 < metaverse.sql
--   sudo docker restart postgrest
--
-- ★ ဒီ table တွေကို PostgREST ကနေ ဘယ်တော့မှ မဖတ်ဘူး — metaverse server က
--   ကိုယ်ပိုင် Postgres connection နဲ့ တိုက်ရိုက်ချိတ်တယ်။ ဒါကြောင့် RLS ကို
--   ဖွင့်ထားပြီး policy တစ်ခုမှ မထားဘူး (wifi_scans နဲ့ တူညီတဲ့ပုံစံ) —
--   anon/authenticated ကနေ ဘာမှ မမြင်ရဘူး၊ မရေးလို့မရဘူး။
-- ★ Guest တွေကို မသိမ်းဘူး — id က session တိုင်း ပြောင်းလို့ သိမ်းစရာ
--   အကြောင်းမရှိဘူး၊ ပြီးတော့ တစ်ခါသုံး row တွေနဲ့ table ကြီးလာမယ်။

begin;

-- ── Player state ────────────────────────────────────────────────────────────
-- user_id က spec မှာ TEXT ဖြစ်ပေမယ့် ဒီ database မှာ profiles.id က uuid
-- ဖြစ်လို့ uuid သုံးတယ် — FK ချိတ်လို့ရပြီး account ဖျက်ရင် metaverse state
-- လိုက်ပျက်တယ် (orphan row မကျန်ဘူး)။
create table if not exists public.mv_players (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  display_name  text not null,
  x             real not null default 0,
  y             real not null default 0,
  z             real not null default 12,
  ry            real not null default 0,
  room          text not null default 'city',
  avatar_color  integer not null default 8251015,
  avatar_glb    text,
  wallet        text,
  total_minutes integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Wallet ကနေ player ကို ရှာဖို့ (Phase 7 — NFT ownership sync)
create index if not exists mv_players_wallet_idx
  on public.mv_players (wallet) where wallet is not null;

-- ── Wallet link nonce (Phase 7) ─────────────────────────────────────────────
-- ★ တစ်ခါသုံး — မဟုတ်ရင် signature တစ်ခုကို ပြန်သုံးပြီး တခြားသူ့ wallet
--   အဖြစ် ဟန်ဆောင်လို့ရမယ် (replay attack)။
create table if not exists public.mv_wallet_nonces (
  nonce      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);

create index if not exists mv_wallet_nonces_created_idx
  on public.mv_wallet_nonces (created_at);

-- ── မြေကွက် (Phase 7 — on-chain ရဲ့ off-chain မှတ်တမ်း) ────────────────────
create table if not exists public.mv_plots (
  plot_id      integer primary key,        -- = NFT tokenId (gx * 32 + gz)
  grid_x       integer not null,
  grid_z       integer not null,
  owner_wallet text,
  owner_user   uuid references public.mv_players (user_id) on delete set null,
  build_data   jsonb,                      -- player ဆောက်ထားတာ (gas မကုန်စေဖို့ off-chain)
  synced_at    timestamptz,
  unique (grid_x, grid_z)
);

-- ── Chat log (moderation) ───────────────────────────────────────────────────
-- ★ user_id က FK မဟုတ်ဘူး — ဧည့်သည်တွေရဲ့ စာလည်း မှတ်ထားရမယ် (moderation
--   အတွက် အဓိကက ဧည့်သည်တွေပဲ)၊ ဒါပေမယ့် ဧည့်သည် id က profiles ထဲမရှိဘူး။
create table if not exists public.mv_chat_log (
  id       bigserial primary key,
  user_id  text not null,
  name     text,
  room     text not null,
  text     text not null,
  at       timestamptz not null default now()
);

-- ၃၀ ရက်ပြီးရင် ဖျက်တဲ့အခါ index scan နဲ့ မြန်အောင်
create index if not exists mv_chat_log_at_idx on public.mv_chat_log (at);

-- ── RLS — policy မထားဘဲ ဖွင့်ထား (sealed) ──────────────────────────────────
alter table public.mv_players       enable row level security;
alter table public.mv_wallet_nonces enable row level security;
alter table public.mv_plots         enable row level security;
alter table public.mv_chat_log      enable row level security;

-- ★ anon/authenticated ကို ဘာမှ မပေးဘူး။ service_role ရှိရင်သာ ပေးတယ်
--   (admin dashboard က နောက်မှ ကြည့်ချင်ရင် အဲဒီလမ်းက ရှိပြီးသား)။
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on
      public.mv_players, public.mv_wallet_nonces, public.mv_plots, public.mv_chat_log
      to service_role;
    grant usage, select on sequence public.mv_chat_log_id_seq to service_role;
  end if;
end $$;

commit;
