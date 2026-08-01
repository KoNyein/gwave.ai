# Metaverse WebSocket server

`gwave.cc/metaverse` ရဲ့ multiplayer အလွှာ။ ECS Fargate ပေါ်မှာ run ပြီး
ALB (`wss://mv.gwave.cc`) နောက်ကွယ်မှာ ရှိတယ်။

```bash
npm install
npm start          # PORT=8080, REQUIRE_AUTH မထည့်ရင် guest ဝင်လို့ရ
npm test           # protocol + anti-cheat + room isolation
```

## Message protocol

| ဦးတည်ရာ | type | payload |
| --- | --- | --- |
| S→C | `init` | `{ id, room, name, authed, serverTime, players }` |
| S→C | `join` | `{ id, state }` |
| S→C | `leave` | `{ id }` |
| C→S | `update` | `{ x, y, z, ry }` |
| S→C | `updates` | `{ p: [[id, x, y, z, ry], …] }` — 15Hz tick တစ်ခါစီ စုပို့ |
| S→C | `correct` | `{ x, y, z }` — anti-cheat က ငြင်းလိုက်တဲ့အခါ |
| C↔S | `chat` | `{ text }` (≤200 လုံး, 0.5s တစ်ကြိမ်) |
| C↔S | `emote` | `{ emote: 'wave'\|'dance'\|'sit'\|null }` |
| C→S | `setname` | `{ name }` — **auth မရှိမှသာ** |
| S→C | `name` | `{ id, name }` |

Close code — `4001` auth လိုတယ် (client က retry မလုပ်ရ), `4002` တခြားနေရာက
ဝင်လိုက်လို့ ဖြုတ်ခံရတယ်, `1001` server restart (client က ပြန်ချိတ်ရမယ်)။

## Environment

| Var | ဘာလုပ်လဲ |
| --- | --- |
| `PORT` | default 8080 |
| `REQUIRE_AUTH` | `true` ဆိုရင် ticket မပါတဲ့သူကို `4001` နဲ့ ပိတ် |
| `MV_TICKET_SECRET` | Next.js ရဲ့ `/api/metaverse/ws-ticket` နဲ့ **တူရမယ်** |
| `DATABASE_URL` | RDS persistence။ မထည့်ရင် လောကက ပုံမှန်အလုပ်လုပ်ပြီး နေရာ မမှတ်ဘူး |
| `REDIS_URL` | Task များခုကြား state မျှဖို့ (ElastiCache)။ မထည့်ရင် task တစ်လုံးတည်း mode |

★ `MV_TICKET_SECRET` နဲ့ `DATABASE_URL` ကို task-definition ရဲ့ `environment`
ထဲ **plain text မထည့်ရ** — `secrets` field နဲ့ Secrets Manager ARN ကိုသာ
ညွှန်းရမယ် (`task-definition.json` မှာ အဲဒီအတိုင်း ရေးထားပြီးသား)။

## Persistence (Phase 4)

Table တွေကို အရင် ဆောက်ရမယ် — EC2 ပေါ်ကနေ:

```bash
DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
curl -sSL https://raw.githubusercontent.com/KoNyein/gwave.ai/claude/phase-1-implementation-7ysxtj/db/sql/metaverse.sql \
  | sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
      psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
           -U gwaveadmin -d gwave -v ON_ERROR_STOP=1
sudo docker restart postgrest
```

★ database က `gwave` — `postgres` မဟုတ်ဘူး။ ထပ်ခါထပ်ခါ run လို့ရတယ်။
စစ်ဆေးဖို့ — table ၄ ခုစလုံး `rls=t` ဖြစ်ရမယ်:

```bash
DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
  psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com -U gwaveadmin -d gwave \
  -c "select tablename, rowsecurity as rls from pg_tables where tablename like 'mv\_%';"
```

ဘယ်လိုအလုပ်လုပ်လဲ:

- နေရာက **memory ထဲမှာ** ရှိတယ်၊ DB ကို ၃၀ စက္ကန့်တစ်ခါ + ထွက်ချိန် +
  SIGTERM ချိန်မှာသာ ရေးတယ် — player တစ်ယောက်လျှင် **တစ်မိနစ် write ၂ ကြိမ်**။
  15Hz update တိုင်း ရေးရင် player ၁၀၀ မှာ တစ်စက္ကန့် write ၁၅၀၀ ဖြစ်ပြီး
  `db.t4g.micro` က ခံနိုင်မှာမဟုတ်ဘူး။
- **ဧည့်သည်ကို မသိမ်းဘူး** — id က session တိုင်း ပြောင်းလို့ ပြန်ဖတ်စရာမရှိဘူး၊
  ပြီးတော့ `profiles` ထဲမှာလည်း မရှိဘူး (FK ကျမယ်)။ ဒါပေမယ့် ဧည့်သည်တွေရဲ့
  **chat ကိုတော့ မှတ်တယ်** — moderation အတွက် အဓိကလိုတာက အဲဒါ။
- **Room တူမှသာ** နေရာဟောင်းကို ပြန်သုံးတယ် — farm က coordinate ကို city ထဲ
  ချလိုက်ရင် နံရံထဲ ဒါမှမဟုတ် လောကအပြင်ဘက် ရောက်နေမယ်။
- **DB ကျနေရင် ဝင်ခွင့်ကို ဘယ်တော့မှ မပိတ်ဘူး** — spawn နေရာမှာ စပြီး
  ဆက်သွားတယ်။
- Chat log ကို ၁ နာရီတစ်ခါ စစ်ပြီး **၃၀ ရက်ကျော်တာကို ဖျက်တယ်** (PII)။

## Auth — ဧည့်သည် (guest) ဝင်ခွင့်

Gwave metaverse က **login မဝင်ဘဲ ဝင်လို့ရတယ်** (`REQUIRE_AUTH=false`)။
ဒါက product ဆုံးဖြတ်ချက် — လူတစ်ယောက်ကို အကောင့်ဖွင့်ခိုင်းပြီးမှ လောကထဲ
ဝင်ခွင့်ပေးရင် အများစုက ဘယ်တော့မှ မဝင်ကြတော့ဘူး။

ဒါပေမယ့် **ဧည့်သည်တစ်ယောက်က အကောင့်ရှိသူတစ်ယောက်အဖြစ် ဟန်ဆောင်လို့
မရရ**ဘူး — ဒါက မလျှော့လို့ရတဲ့ အချက်:

| | Signed in (ticket ပါ) | ဧည့်သည် (ticket မပါ) |
| --- | --- | --- |
| နာမည် | Cognito username — client က ပြောင်းလို့ **မရ** | ကိုယ်တိုင်ပေးလို့ရ |
| `authed` | `true` | `false` — message တိုင်းမှာ ပါလာတယ် |
| Client မှာ ပြပုံ | အစိမ်းရောင် နာမည် | "ဧည့်သည်" အမှတ်အသား အမြဲပါ |

★ `authed` က server ကနေသာ လာတယ်၊ နာမည်ကနေ ခန့်မှန်းလို့မရဘူး — ဧည့်သည်
တစ်ယောက်က `KoNyein` လို့ နာမည်ပေးလိုက်လည်း "ဧည့်သည်" chip က ကပ်နေမယ်။

★ **ticket ပါလာပြီး မမှန်ရင် guest အဖြစ် မကျဆင်းရ** — `4001` နဲ့ ပိတ်တယ်။
မဟုတ်ရင် ticket ကို ဖျက်ပစ်လိုက်ရုံနဲ့ စစ်ဆေးမှုကို ကျော်လို့ရသွားမယ်။

## Deploy — ECR + ECS Fargate

```bash
export ACCOUNT_ID=<account>
export REGION=ap-southeast-1        # Mae Sot နဲ့ latency အနီးဆုံး

aws ecr create-repository --repository-name gwave-metaverse --region $REGION
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# ★ --platform linux/amd64 မဖြစ်မနေ — M1/M2 Mac ကနေ build ရင် arm64 image
#   ဖြစ်ပြီး Fargate မှာ "exec format error" နဲ့ ချက်ချင်းသေမယ်။
docker build --platform linux/amd64 -t gwave-metaverse .
docker tag gwave-metaverse:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/gwave-metaverse:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/gwave-metaverse:latest

# task-definition.json ထဲက <ACCOUNT> တွေ အစားထိုးပြီး
aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION
```

### ALB — WebSocket အတွက် မဖြစ်မနေ ၂ ခု

```bash
# 1. idle timeout — default 60s က WebSocket အတွက် တိုလွန်းတယ်။ ၅ မိနစ်တိုင်း
#    connection ပြတ်တဲ့ ပြဿနာက အများအားဖြင့် ဒါကြောင့်။
aws elbv2 modify-load-balancer-attributes --load-balancer-arn $ALB_ARN \
  --attributes Key=idle_timeout.timeout_seconds,Value=300 --region $REGION

# 2. stickiness — player တစ်ယောက် task တစ်လုံးတည်းမှာ နေဖို့။ မဖွင့်ရင် task
#    ၂ လုံးဆိုတာနဲ့ player တွေ တစ်ယောက်နဲ့တစ်ယောက် မမြင်ရတော့ဘူး
#    (state က task memory ထဲမှာ ရှိလို့ — Redis က Phase 6.2)။
aws elbv2 modify-target-group-attributes --target-group-arn $TG_ARN \
  --attributes Key=stickiness.enabled,Value=true \
               Key=stickiness.type,Value=lb_cookie \
               Key=deregistration_delay.timeout_seconds,Value=30 --region $REGION
```

- **Health check** — path `/health`, port 8080. ဒါမရှိရင် ALB က target ကို
  unhealthy လုပ်ပြီး ECS က container ကို ထပ်ခါထပ်ခါ ပြန်စတယ်။
- **HTTPS မဖြစ်မနေ** — gwave.cc က HTTPS ဖြစ်လို့ browser က `ws://` ကို ပိတ်တယ်။
  ACM cert (`mv.gwave.cc`) + HTTPS listener 443 → target group 8080။
- **Security group ၂ ခု** — ALB SG (internet → 443)၊ Task SG (**ALB SG ကနေသာ**
  → 8080)။ Container ကို internet ကနေ တိုက်ရိုက်မဖွင့်ရ။
- **Route 53** — `mv.gwave.cc` → ALB (alias)။

### စစ်ဆေးရန်

```bash
curl https://mv.gwave.cc/health          # {"status":"ok",...}
aws ecs update-service --cluster gwave-cluster --service metaverse \
  --force-new-deployment --region $REGION
# ★ deploy လုပ်နေစဉ် browser tab ကို ဖွင့်ထား — client က အလိုအလျောက်
#   ပြန်ချိတ်ရမယ် (SIGTERM → close 1001 → backoff reconnect)
```

## Scale (Phase 6.2)

### Task တစ်လုံးက ဘယ်လောက် ခံနိုင်လဲ

`node loadtest.js` (bot တွေက 15Hz နဲ့ ရွှေ့တယ်၊ ၂၀ စက္ကန့်) နဲ့ တိုင်းတာချက်:

| Bot | Server CPU | ပြင်ပသို့ message |
| --- | --- | --- |
| ၅၀ | 6% | ၁,၀၀၀/s |
| ၂၀၀ | 9% | ၄,၀၀၀/s |
| ၈၀၀ | 70% | ၂၅,၀၀၀/s |

```bash
node loadtest.js                    # bot ၅၀
BOTS=800 SECONDS=30 node loadtest.js
```

★ **နေရာတွေကို စုပို့တယ်** (`updates` message)။ ရွှေ့တိုင်း သီးခြားပို့ရင်
fan-out က n² — player ၂၀၀ မှာ တစ်စက္ကန့် send ၅၆၀,၀၀၀ ဖြစ်ပြီး core
တစ်ခုလုံး ၉၈% ကုန်တယ် (တိုင်းတာပြီးသား)။ 15Hz tick မှာ တစ်ခါတည်း စုပို့တော့
၄,၀၀၀ ကျပြီး CPU က ၉% ပဲ။ ဒါကြောင့် task တစ်လုံးက **~၆၀၀ ယောက်** ခံနိုင်တယ်
(spec ရဲ့ ခန့်မှန်း ၂၀၀ မဟုတ်တော့ဘူး)။

### Redis (ElastiCache) — task ၂ လုံးအထက်မှ

Task တစ်လုံးထက် များရင် `REDIS_URL` မဖြစ်မနေ လိုတယ် — မဟုတ်ရင် task A ကလူတွေက
task B ကလူတွေကို **လုံးဝ မမြင်ရဘူး** (တစ်လောကထဲမှာ ရှိပေမယ့် မတွေ့တဲ့ လောက ၂ ခု)။

```bash
aws elasticache create-cache-cluster --cache-cluster-id gwave-mv \
  --engine redis --cache-node-type cache.t4g.micro --num-cache-nodes 1 \
  --security-group-ids $TASK_SG --region $REGION
# → REDIS_URL=redis://gwave-mv.xxxx.cache.amazonaws.com:6379 (Secrets Manager)
```

- Task တစ်ခုချင်းက `mv:{room}` channel ကို subscribe လုပ်တယ်။
- ၅ စက္ကန့်တစ်ခါ ကိုယ့် player စာရင်း အပြည့်အစုံ ကြေညာတယ် (`sync`) —
  ★ ဒါမရှိရင် task အသစ်တက်ချိန်မှာ **ငြိမ်နေတဲ့သူတွေကို ဘယ်တော့မှ မမြင်ရဘူး**
  (မရွှေ့ရင် update မပို့လို့)။
- Task တစ်လုံး ရုတ်တရက် သေရင် သူ့လူတွေက ၁၅ စက္ကန့်အတွင်း ပျောက်တယ် (TTL)။
- Redis ကျရင် server က မကျဘူး — task တစ်လုံးတည်း အဖြစ် ကျဆင်းသွားရုံပဲ။

### Auto-scaling

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/gwave-cluster/metaverse \
  --min-capacity 1 --max-capacity 6 --region $REGION

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/gwave-cluster/metaverse \
  --policy-name mv-cpu65 --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    '{"TargetValue":65,"PredefinedMetricSpecification":{"PredefinedMetricType":"ECSServiceAverageCPUUtilization"},"ScaleInCooldown":300,"ScaleOutCooldown":60}' \
  --region $REGION
```

★ ScaleIn cooldown ကို ရှည်ရှည် (၅ မိနစ်) ထားရတယ် — WebSocket connection တွေက
ရှည်လျားတာမို့ task တစ်လုံး ဖြုတ်လိုက်တိုင်း အဲဒီပေါ်က player တွေ ပြန်ချိတ်ရတယ်။

## သိထားသင့်တဲ့ ကန့်သတ်ချက်

- Player state က **task ရဲ့ memory ထဲမှာ** ရှိတယ်။ `REDIS_URL` မထည့်ရင်
  task ၂ လုံးက player တွေ တစ်ယောက်နဲ့တစ်ယောက် မမြင်ရဘူး — အဲဒီအခြေအနေမှာ
  ALB stickiness က မဖြစ်မနေလိုတယ်။
- `updates` က နေရာတွေကို 15Hz မှာ စုပို့တာမို့ တစ်ယောက်ရဲ့ ရွှေ့မှုက
  အများဆုံး ၆၆ ms နောက်ကျပြီးမှ တခြားသူဆီ ရောက်တယ်။ Client က interpolate
  လုပ်ထားလို့ မျက်လုံးနဲ့ မမြင်ရဘူး။
- နောက်ဆုံး flush ကနေ ပြတ်သွားချိန်အထိ (အများဆုံး ၃၀ စက္ကန့်) ရွှေ့ခဲ့တာက
  server ကို **တစ်ခါတည်း သတ်လိုက်ရင်** (SIGKILL / task crash) ပျောက်တယ်။
  ပုံမှန် deploy (SIGTERM) မှာတော့ မပျောက်ဘူး။
