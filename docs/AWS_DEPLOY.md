# gwave.ai — AWS Deployment (ECS Fargate + self-hosted media)

App ကို **ECS Fargate** ပေါ်၊ **Live + CCTV** ကို **self-hosted MediaMTX** ပေါ်၊
messenger **video call** ကို **coturn** TURN server ဖြင့် AWS မှာ run ဖို့
step-by-step guide။ ဒီ repo ရဲ့ `deploy/` folder ထဲ scripts တွေ ပါပြီးသား။

> **Claude CLI ကို ခိုင်းချင်ရင်:** "follow docs/AWS_DEPLOY.md, Part A first"
> လို့ ပြောပြီး region / domain / instance size တွေ သတ်မှတ်ပေးပါ။

---

## 🏗️ Architecture

```
                       ┌──────────────────────────┐
  browsers / TWA  ───► │  ALB (HTTPS, ACM cert)    │
                       └────────────┬─────────────┘
                                    ▼
                       ┌──────────────────────────┐     ┌───────────────┐
                       │  ECS Fargate: gwave-web   │────►│  Supabase     │
                       │  (Next.js standalone)     │     │  (DB/Auth/RT) │
                       └──────────────────────────┘     └───────────────┘
        Live/CCTV HLS  ▲                         ▲  WebRTC relay
                       │                         │
              ┌────────┴────────┐       ┌────────┴────────┐
              │ EC2: MediaMTX   │       │ EC2: coturn     │
              │ RTMP+RTSP→HLS   │       │ TURN/STUN       │
              │ media.domain    │       │ Elastic IP      │
              └─────────────────┘       └─────────────────┘
```

DB/Auth/Realtime/Storage က **Supabase** (managed) — AWS မှာ DB မ run ရ။

---

## 0. Prerequisites

- Domain တစ်ခု (ဥပမာ `yourdomain.com`) — subdomains: `app.`, `media.`, `turn.`
- AWS CLI + IAM user (ECR, ECS, EC2, ELB, ACM, Secrets Manager, IAM permission)
- `aws configure` ပြီးပြီး၊ default region သတ်မှတ်ပြီး
- Supabase project (SQL migrations အားလုံး run ပြီး)

---

## Part A — App on ECS Fargate

### A1. ECR repo + image push
```bash
export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export REGION=ap-southeast-1                   # ကိုယ့် region
aws ecr create-repository --repository-name gwave-web --region $REGION
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# NEXT_PUBLIC_* က build-time မှာ inline ဖြစ်လို့ build-arg အနေနဲ့ ပေးရ
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com \
  --build-arg NEXT_PUBLIC_TURN_URL=turn:TURN_EIP:3478 \
  --build-arg NEXT_PUBLIC_TURN_USERNAME=gwave \
  --build-arg NEXT_PUBLIC_TURN_CREDENTIAL=SECRET \
  --build-arg NEXT_PUBLIC_CCTV_PLAYER_ORIGIN=https://media.yourdomain.com \
  --build-arg NEXT_PUBLIC_CCTV_HLS_ORIGINS=https://media.yourdomain.com \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=BObc... \
  -t gwave-web:latest .

docker tag gwave-web:latest $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/gwave-web:latest
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/gwave-web:latest
```

### A2. Secrets (server-only) → Secrets Manager
Runtime-only secret တိုင်းကို Secrets Manager မှာ ထား (image ထဲ မထည့်):
```bash
for k in SUPABASE_SERVICE_ROLE_KEY MUX_TOKEN_ID MUX_TOKEN_SECRET MUX_WEBHOOK_SECRET \
         STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET CCTV_MEDIA_API_URL CCTV_MEDIA_API_TOKEN \
         TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM VAPID_PRIVATE_KEY VAPID_SUBJECT; do
  aws secretsmanager create-secret --name gwave/$k --secret-string "REPLACE_ME" --region $REGION
done
```
(ပြီးရင် value တွေကို `aws secretsmanager put-secret-value` နဲ့ ပြင်။)

### A3. Task definition + service
- `deploy/ecs-task-definition.json` ထဲ `<ACCOUNT>`, `<REGION>`, secret ARN တွေ ပြင်။
- Execution role (`gwaveEcsExecutionRole`) မှာ `AmazonECSTaskExecutionRolePolicy`
  + Secrets Manager `secretsmanager:GetSecretValue` ခွင့် ထည့်။
```bash
aws ecs register-task-definition --cli-input-json file://deploy/ecs-task-definition.json --region $REGION
aws ecs create-cluster --cluster-name gwave --region $REGION
```
- **ALB** တစ်ခု ဆောက် (HTTPS:443, ACM cert for `app.yourdomain.com`), target group
  → port 3000, health-check path `/api/health`။
- ECS **service** ဖန်တီး (Fargate, awsvpc, public subnets or private+NAT, ALB target
  group ကို attach)၊ desired count 2။
- Route 53: `app.yourdomain.com` → ALB (alias)။

### A4. CI (optional)
GitHub Actions မှာ build → `docker push` → `aws ecs update-service --force-new-deployment`
ထည့်ရင် push တိုင်း auto-deploy။

---

## Part B — Live + CCTV media server (self-hosted MediaMTX)

> Live self-host = MediaMTX က host RTMP ကို ingest → HLS ပြန်ထုတ်။ CCTV = camera
> RTSP → HLS။ တစ်ခုတည်း server နဲ့ နှစ်ခုလုံး ရ။

### B1. EC2 + DNS
- Ubuntu 22.04, **t3.medium+**, Elastic IP allocate + associate။
- Security group: TCP **8554, 1935, 8888, 443, 9997**, UDP **8189, 8000**။
- Route 53: `media.yourdomain.com` → Elastic IP (A record)။

### B2. Install
```bash
scp deploy/mediamtx-setup.sh deploy/mediamtx.yml ubuntu@MEDIA_EIP:/tmp/
ssh ubuntu@MEDIA_EIP 'sudo bash /tmp/mediamtx-setup.sh media.yourdomain.com you@email.com'
```
Script က MediaMTX + Caddy(TLS) တင်ပြီး env value တွေ print ထုတ်ပေးမယ်။

### B3. CCTV cameras
`/opt/mediamtx/mediamtx.yml` ရဲ့ `paths:` အောက်မှာ camera တစ်လုံးချင်း RTSP ထည့်
(sample comment ပါပြီးသား) → `sudo systemctl restart mediamtx`။ App ရဲ့ camera
record ထဲ HLS URL: `https://media.yourdomain.com/cctv/<name>/index.m3u8`။

### B4. Live — code adapter (⚠️ လိုအပ်)
App ရဲ့ live route (`src/app/api/live/*`, `src/lib/mux.ts`) က **Mux API** ကို
ခေါ်နေဆဲ။ Self-host Mux အစား MediaMTX သုံးဖို့ ဒီ ၃ ခု ပြင်ရမယ်:
- `create` → stream key generate + RTMP URL `rtmp://media.domain:1935/live/<key>`
  ပြန်ပေး (Mux create အစား)။
- `webhook` → MediaMTX `runOnReady`/`runOnNotReady` hook နဲ့ status update (Mux
  webhook အစား)။
- player → HLS `https://media.domain/live/<key>/index.m3u8` (Mux playback အစား)။

> ဒီ code adapter ကို ကျွန်တော် သီးသန့် PR အနေနဲ့ ရေးပေးလို့ရပါတယ် — ပြောလိုက်ရုံ။
> အလွယ်လိုချင်ရင် Live ကို **Mux** (managed) ပဲ ဆက်သုံးပြီး CCTV ကိုသာ self-host
> လုပ်ရင်လည်း ရ (code ပြင်စရာ မလို)။

---

## Part C — Video call TURN (coturn)

### C1. EC2 + Elastic IP
- Ubuntu 22.04, **t3.small**, Elastic IP။
- Security group: UDP+TCP **3478**, UDP+TCP **5349**, UDP **49152-65535**။

### C2. Install
```bash
scp deploy/coturn-setup.sh ubuntu@TURN_EIP:/tmp/
ssh ubuntu@TURN_EIP 'sudo bash /tmp/coturn-setup.sh TURN_EIP gwave STRONG_SECRET gwave.ai'
```
Print ထုတ်ပေးတဲ့ `NEXT_PUBLIC_TURN_*` ၃ ခုကို **build-arg** (Part A1) မှာ ထည့်ပြီး
image ပြန် build/deploy။ (TURN သည် client-side ဖြစ်လို့ build-time မှာ inline ဖြစ်ရ။)

---

## Part D — Co-host Live SFU (LiveKit)

> Mesh WebRTC grid သည် co-host ~၆ ဦးအထိသာ။ ပရိသတ် **ထောင်ဂဏန်း** အထိ scale ချင်ရင်
> **LiveKit SFU** (media server) သုံးရမယ်။ Publisher (host + approved co-host) များက
> ကင်မရာ/မိုက် ပို့ → LiveKit က viewer အားလုံးဆီ ဖြန့်ဝေ (viewer တွေက subscribe-only)။
> Env မထည့်ရင် app က အလိုအလျောက် mesh ကို fallback လုပ်တယ်။

### D1. EC2 + DNS
- Ubuntu 22.04, **t3.large+**, Elastic IP။ `live.yourdomain.com` → EIP။
- Security group: TCP **443**, TCP **7881**, UDP **50000-60000**, (optional TURN) UDP **3478** / TCP **5349**။

### D2. Install
```bash
scp deploy/livekit-setup.sh deploy/livekit.yaml ubuntu@LIVE_EIP:/tmp/
ssh ubuntu@LIVE_EIP 'sudo bash /tmp/livekit-setup.sh live.yourdomain.com you@email.com'
```
Script က LiveKit + Caddy(TLS) တင်ပြီး `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET` ၃ ခု print ထုတ်ပေးမယ်။

### D3. App env
- `NEXT_PUBLIC_LIVEKIT_URL` → **build-arg** (client connect URL)။
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` → **secret** (Secrets Manager → task def)။
  Secret သည် publish token mint လုပ်နိုင်လို့ private ထားပါ။

> LiveKit **Cloud** သုံးချင်ရင် EC2 မလို — dashboard က URL/key/secret ၃ ခုကိုပဲ ထည့်လိုက်ပါ။

---

## 🔑 Environment variable reference

| Var | Where | Feature |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` | build-arg | core |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | server |
| `NEXT_PUBLIC_SITE_URL` | build-arg | auth redirects |
| `NEXT_PUBLIC_TURN_URL/USERNAME/CREDENTIAL` | build-arg | 📞 video calls |
| `NEXT_PUBLIC_CCTV_PLAYER_ORIGIN` / `_HLS_ORIGINS` / `_APP` | build-arg | 📹 CCTV |
| `CCTV_MEDIA_API_URL` / `CCTV_MEDIA_API_TOKEN` | secret | 📹 CCTV control |
| `MUX_TOKEN_ID/SECRET/WEBHOOK_SECRET` | secret | 🔴 Live (Mux path) |
| `NEXT_PUBLIC_LIVEKIT_URL` | build-arg | 👥 Co-host Live (SFU) |
| `LIVEKIT_API_KEY/SECRET` | secret | 👥 Co-host Live tokens |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM` | secret | 📱 G-Pay OTP |
| `STRIPE_SECRET_KEY/WEBHOOK_SECRET` | secret | membership |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | build-arg / secret | push |

> **build-arg** = `NEXT_PUBLIC_*`, image ထဲ inline; ပြောင်းရင် rebuild လို။
> **secret** = runtime only, Secrets Manager → task definition။

---

## ✅ Post-deploy checklist

- [ ] `https://app.yourdomain.com/api/health` → `ok`
- [ ] Supabase Auth → Redirect URLs မှာ `https://app.yourdomain.com/auth/callback` ထည့်
- [ ] Mux webhook (Live-via-Mux သုံးရင်) → `https://app.yourdomain.com/api/live/webhook`
- [ ] Stripe webhook → `https://app.yourdomain.com/api/stripe/webhook`
- [ ] Trickle-ICE test နဲ့ TURN relay အလုပ်လုပ်မှု စစ်
- [ ] CCTV camera RTSP → `media.domain/cctv/<name>/index.m3u8` play ဖြစ်မှု စစ်
