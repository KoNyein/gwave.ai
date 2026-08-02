-- Game progress + quests — cross-device persistence for the 3D games
-- (Edu Arcade / FPV sim / quests)။
--
-- ★ အရင်က ဂိမ်းရမှတ်တွေက localStorage သာ — ဖုန်းပြောင်းရင် ပျောက်တယ်။
--   ဒီ table က signed-in user ရဲ့ best score / quest တိုးတက်မှုကို
--   server မှာ သိမ်းပြီး device တိုင်း တူညီစေတယ်။
-- ★ mv_* table တွေအတိုင်း sealed RLS — PostgREST anon/authenticated ကနေ
--   တိုက်ရိုက် မဖတ်ရ၊ Next.js server (service_role) ကနေသာ။
--
-- Apply on EC2:
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   curl -fsSL https://raw.githubusercontent.com/KoNyein/gwave.ai/main/db/sql/game-progress.sql \
--     | sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--       psql "host=<RDS_HOST> user=gwaveadmin dbname=gwave sslmode=require"
--   sudo docker restart postgrest

begin;

create table if not exists public.game_progress (
  profile_id uuid        not null,
  game       text        not null,
  -- ကြီးလေကောင်းလေ ရမှတ် (lap time လို သေးလေကောင်းလေ တန်ဖိုးတွေက data ထဲ)
  best       integer     not null default 0,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, game)
);

create index if not exists game_progress_game_best_idx
  on public.game_progress (game, best desc);

-- Sealed RLS — policy မရှိ = PostgREST role တွေ ဘာမှ မမြင်ရ
alter table public.game_progress enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.game_progress to service_role;
  end if;
end $$;

commit;
