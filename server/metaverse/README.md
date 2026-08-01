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
| C↔S | `update` | `{ x, y, z, ry }` |
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

## သိထားသင့်တဲ့ ကန့်သတ်ချက်

- Player state က **task ရဲ့ memory ထဲမှာ** ရှိတယ်။ Task ၂ လုံးဆိုရင် stickiness
  မဖြစ်မနေ လိုတယ်။ တကယ် scale (player ၁၀၀၀+) ဖြစ်ချင်ရင် Redis pub/sub —
  Phase 6.2။
- Persistence မရှိသေးဘူး — server restart ရင် နေရာ ပြန်စတယ်။ Phase 4 (RDS)
  မှာ ထည့်မယ်။
