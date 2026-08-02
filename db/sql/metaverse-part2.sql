-- Gwave Metaverse — Part 2 (Phase 14–19)
--
-- RDS မှာ run ရန် (EC2 app box ပေါ်ကနေ):
--
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   curl -sSL https://raw.githubusercontent.com/KoNyein/gwave.ai/claude/phase-1-implementation-7ysxtj/db/sql/metaverse-part2.sql \
--     | sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--         psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
--              -U gwaveadmin -d gwave -v ON_ERROR_STOP=1
--   sudo docker restart postgrest
--
-- ★ `metaverse.sql` ကို အရင် run ထားရမယ် (mv_players, mv_plots ရှိရမယ်)။
-- ★ ဒီ table တွေကိုလည်း PostgREST ကနေ မဖတ်ဘူး — RLS ဖွင့်ပြီး policy
--   မထားဘူး (sealed)။ metaverse server နဲ့ Next.js route တွေက
--   service_role နဲ့ ချိတ်တယ်။

begin;

-- ── Avatar (Phase 15) ───────────────────────────────────────────────────────
-- ★ JSON တစ်ခုတည်း — network ပို့ရလွယ်၊ column ထပ်ထည့်စရာမလို။
--   `v` field က version — အနာဂတ်မှာ ပုံစံပြောင်းရင် migrate လုပ်ဖို့။
alter table public.mv_players
  add column if not exists avatar_config jsonb;

-- ── ပိုင်ဆိုင်တဲ့ပစ္စည်း (Phase 15 + 19) ─────────────────────────────────────
-- ★ Client မှာ ဖျောက်ထားရုံနဲ့ မလုံခြုံဘူး — server က ဒီ table ကို
--   ကြည့်ပြီးမှ avatar config ကို လက်ခံတယ်။
create table if not exists public.mv_inventory (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  sku      text not null,
  qty      integer not null default 1 check (qty >= 0),
  source   text not null default 'purchase',   -- purchase | reward | nft | grant
  added_at timestamptz not null default now(),
  primary key (user_id, sku)
);

create index if not exists mv_inventory_sku_idx on public.mv_inventory (sku);

-- ── Mini-game အမှတ် (Phase 16) ──────────────────────────────────────────────
-- ★ user_id က text — ဧည့်သည်လည်း ကစားလို့ရတယ် (profiles ထဲမှာ မရှိဘူး)
create table if not exists public.mv_game_scores (
  id        bigserial primary key,
  game_id   text not null,
  user_id   text not null,
  name      text,
  score     integer not null,
  rank      integer not null,
  played_at timestamptz not null default now()
);

-- ★ တစ်ပတ်စာ leaderboard က နောက်ကျမှစတဲ့သူတွေအတွက် အားပေးမှု —
--   all-time ပဲပြရင် ထိပ်ဆုံးကို ဘယ်တော့မှ မမီဘူးလို့ ခံစားရမယ်။
create index if not exists mv_game_scores_board_idx
  on public.mv_game_scores (game_id, score desc, played_at desc);
create index if not exists mv_game_scores_recent_idx
  on public.mv_game_scores (played_at desc);

-- ── ဆောက်လုပ်မှု report (Phase 18) ──────────────────────────────────────────
-- ★ User က content ဖန်တီးခွင့်ရတာနဲ့ moderation တာဝန် ပါလာတယ်။
--   Report ခလုတ်၊ admin ဖျက်ခွင့်၊ ၂၄ နာရီ queue — ၃ ခုစလုံး မဖြစ်မနေ။
create table if not exists public.mv_build_reports (
  id          bigserial primary key,
  plot_id     integer not null,
  reporter    text not null,
  reason      text,
  status      text not null default 'open',   -- open | dismissed | removed
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create index if not exists mv_build_reports_open_idx
  on public.mv_build_reports (status, created_at desc);

-- ── Marketplace (Phase 19) ──────────────────────────────────────────────────
-- ⚠️ ဒီ table တွေ ရှိရုံနဲ့ marketplace မဖွင့်သေးဘူး။ `MV_MARKET_ENABLED`
--    env က default ပိတ်ထားပြီး **ဥပဒေခွင့်ပြုချက်ရမှ** ဖွင့်ရမယ် (spec 19.0)။
create table if not exists public.mv_listings (
  id          bigserial primary key,
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('item', 'plot')),
  sku         text,
  plot_id     integer,
  price_minor bigint not null check (price_minor > 0),
  currency    char(3) not null default 'THB',
  status      text not null default 'active'
              check (status in ('active', 'sold', 'cancelled', 'expired')),
  -- ★ ကော်မရှင်ကို ရောင်းသူဆီက ဖြတ်တယ် — ဝယ်သူဆီက မဟုတ်။
  --   စျေးနှုန်း ရှင်းလင်းဖို့ (ကြော်ငြာစျေး = ပေးရမယ့်စျေး)။
  fee_bps     integer not null default 500,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  sold_to     uuid references public.profiles (id) on delete set null,
  sold_at     timestamptz,
  -- ★ တစ်ခါနှိပ်တာကို ၂ ခါ မဖြစ်စေဖို့
  idempotency_key text unique
);

create index if not exists mv_listings_browse_idx
  on public.mv_listings (status, kind, created_at desc);
create index if not exists mv_listings_seller_idx
  on public.mv_listings (seller_id, status);

-- ★ Escrow — listing တင်တာနဲ့ ပစ္စည်းကို inventory ကနေ ဖယ်ထားတယ်။
--   မဟုတ်ရင် တစ်ခုတည်းကို နှစ်နေရာ ရောင်းလို့ရမယ်။
create table if not exists public.mv_escrow (
  listing_id bigint primary key references public.mv_listings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  sku        text,
  plot_id    integer,
  locked_at  timestamptz not null default now()
);

-- ── RLS — policy မထားဘဲ ဖွင့်ထား (sealed) ──────────────────────────────────
alter table public.mv_inventory     enable row level security;
alter table public.mv_game_scores   enable row level security;
alter table public.mv_build_reports enable row level security;
alter table public.mv_listings      enable row level security;
alter table public.mv_escrow        enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on
      public.mv_inventory, public.mv_game_scores, public.mv_build_reports,
      public.mv_listings, public.mv_escrow
      to service_role;
    grant usage, select on sequence public.mv_game_scores_id_seq to service_role;
    grant usage, select on sequence public.mv_build_reports_id_seq to service_role;
    grant usage, select on sequence public.mv_listings_id_seq to service_role;
  end if;
end $$;

commit;
