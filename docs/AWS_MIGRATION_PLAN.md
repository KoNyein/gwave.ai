# Supabase → AWS ပြောင်းရွှေ့ရေး အစီအစဉ်

**ရည်မှန်းချက်:** Auth (SMS provider အပါအဝင်) နဲ့ backend တစ်ခုလုံးကို AWS
infrastructure ထဲ ပြောင်းရန်။ Supabase ကို လုံးဝ ဖြုတ်ရန်။

**ရေးသည့်ရက်:** 2026-07-14 · **အခြေအနေ:** Phase 0 (တိုင်းတာပြီး၊ အတည်ပြုစောင့်)

---

## ၁။ လက်ရှိ အခြေအနေ — တိုင်းတာချက် (မှန်းဆချက် မဟုတ်)

| အရာ | အရေအတွက် | ဆိုလိုရင်း |
|---|---|---|
| Supabase ကို import လုပ်တဲ့ ဖိုင် | **151** | client/server ဖိုင် တိုင်း ထိရမယ် |
| RLS policy | **226** (auth.uid() သုံး: **153**) | auth ပြောင်းရင် အားလုံး ပျက်နိုင် |
| Realtime channel သုံးတဲ့ ဖိုင် | **38** | messenger, live, games, calls, farm |
| Storage သုံးတဲ့ ဖိုင် | **12** | `media` bucket (public) |
| Server action | **45** | RLS-scoped server client သုံး |
| API route | **23** | |
| SQL migration | **65** | |
| User | **18** (Google 8, email 10) | password hash ရွှေ့မရ |

**အဓိက အချက်:** Supabase က ဒီ app မှာ "database" တစ်ခုတည်း မဟုတ်ပါ —
**Auth + Postgres + RLS + Realtime + Storage** ဆိုတဲ့ ၅ ခု တွဲထားတဲ့ platform
ဖြစ်နေတယ်။ ဒါကြောင့် "auth ပဲ ပြောင်းမယ်" ဆိုတာ မဖြစ်နိုင်ဘဲ၊ ၅ ခုလုံး
အစားထိုးရမယ်။

---

## ၂။ ပစ်မှတ် architecture (AWS အပြည့်)

```
                    ┌──────────────────────────────┐
   Browser / APK ──▶│  EC2 (18.139.214.180) Caddy  │
                    │  Next.js app (ရှိပြီးသား)      │
                    └───────┬──────────────┬────────┘
                            │              │
              ┌─────────────▼───┐   ┌──────▼──────────────┐
              │ Amazon Cognito  │   │ WebSocket service    │
              │ User Pool       │   │ (EC2, Node + ws)     │
              │ · email/pass    │   │ Postgres LISTEN/NOTIFY│
              │ · phone + SMS   │   │ + broadcast rooms     │
              │ · Google IdP    │   └──────┬───────────────┘
              └────────┬────────┘          │
                       │ SMS               │
              ┌────────▼────────┐   ┌──────▼──────────────┐
              │ SNS / Pinpoint  │   │ RDS PostgreSQL      │
              │ SMS (+95)       │   │ (RLS ဆက်သုံး)        │
              └─────────────────┘   └─────────────────────┘
                                    ┌─────────────────────┐
                                    │ S3 (media) + CloudFront│
                                    └─────────────────────┘
```

### အစားထိုးဇယား

| Supabase | AWS အစား | မှတ်ချက် |
|---|---|---|
| Supabase Auth (GoTrue) | **Cognito User Pool** | email/password, phone OTP, Google federation |
| SMS | **SNS / Pinpoint SMS** | ⚠️ account activate လိုအပ် (အောက်တွင်) |
| Postgres | **RDS PostgreSQL** (db.t4g.micro) | **RLS က Postgres feature — ဆက်သုံးလို့ရ** |
| `auth.uid()` | `current_setting('app.user_id')` ဖတ်တဲ့ **ကိုယ်ပိုင် `auth.uid()`** | policy 153 ခု **မပြင်ရ** |
| PostgREST (`.from()`) | **ကိုယ်ပိုင် data layer** (`pg` / Drizzle) | ဖိုင် 151 ခု ပြင်ရမယ် ← အကြီးဆုံး |
| Realtime | **WebSocket service** (EC2) | postgres_changes → LISTEN/NOTIFY + trigger |
| Storage | **S3 + presigned URL** | bucket policy = ကိုယ်ပိုင် ACL |

### 🔑 အရေးအကြီးဆုံး နည်းပညာ အချက်

**RLS policy ၁၅၃ ခုကို မပြင်ဘဲ ဆက်သုံးနိုင်ပါတယ်။** နည်းလမ်းက:

```sql
-- RDS မှာ ကိုယ်ပိုင် auth schema
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;
```

Request တိုင်းမှာ app က `SET LOCAL app.user_id = '<cognito ကနေ ရတဲ့ id>'`
လုပ်ပေးရုံပါပဲ။ ဒါဆို `auth.uid()` က အလုပ်လုပ်ပြီး **policy တစ်ခုမှ မပြင်ရပါ**။

---

## ၃။ အဆင့်ဆင့် အစီအစဉ်

### Phase 1 — Cognito တည်ဆောက် (၂–၃ ရက်)
- [ ] User Pool + App Client (ap-southeast-1)
- [ ] Google IdP ချိတ် (client ID ရှိပြီးသား — ပြန်သုံးလို့ရ)
- [ ] Phone (SMS OTP) ဖွင့် — **AWS SMS activate ပြီးမှ**
- [ ] Custom attribute: `custom:profile_id` (ရှိပြီးသား user id သိမ်းရန်)
- [ ] Password policy, MFA (optional), token သက်တမ်း
- **ဖြုတ်ချလို့ရ (reversible) · ကုန်ကျစရိတ် ~$0**

### Phase 2 — RDS + data ရွှေ့ (၃–၅ ရက်)
- [ ] RDS PostgreSQL 15 (db.t4g.micro, ap-southeast-1, private subnet)
- [ ] Supabase ကနေ `pg_dump` → RDS ကို restore (65 migration အားလုံး ပါ)
- [ ] `auth` schema shim (`auth.uid()`, `auth.users` table)
- [ ] RLS policy 226 ခု အလုပ်လုပ်မလုပ် **အလိုအလျောက် စမ်းသပ်** (script)
- **အန္တရာယ်: အလယ်အလတ် · စရိတ် ~$15/လ**

### Phase 3 — Data layer ပြန်ရေး (၁၀–၁၅ ရက်) ← **အကြီးဆုံး**
- [ ] `src/lib/supabase/*` → `src/lib/db/*` (pg pool + per-request `SET LOCAL`)
- [ ] `.from().select()` ခေါ်ဆိုမှု အားလုံး → SQL / query builder
- [ ] Server action 45 ခု၊ API route 23 ခု ပြန်ချိတ်
- [ ] ဖိုင် 151 ခု ထိရမယ်
- **အန္တရာယ်: မြင့် (bug အများဆုံး ဒီမှာ ဖြစ်မယ်)**

### Phase 4 — Realtime အစားထိုး (၅–၇ ရက်)
- [ ] EC2 ပေါ်မှာ WebSocket service (Node + `ws` + JWT auth)
- [ ] `postgres_changes` → DB trigger + `pg_notify` → WS broadcast
- [ ] `broadcast` (typing, games, calls signaling) → WS room
- [ ] Channel 12+ မျိုး ပြန်ချိတ် (messenger, chess, calls, live, farm…)
- **အန္တရာယ်: မြင့် (call/messenger လုံးဝ မှီခို)**

### Phase 5 — Storage → S3 (၂–၃ ရက်)
- [ ] S3 bucket + CloudFront
- [ ] `uploadMedia/uploadFile/uploadVoice` → presigned PUT
- [ ] `mediaUrl()` → CloudFront URL
- [ ] ရှိပြီးသား ဖိုင်တွေ Supabase Storage → S3 ကူး
- **⚠️ URL တွေ ပြောင်းမယ် → DB ထဲက path တွေ migrate ရမယ်**

### Phase 6 — User ရွှေ့ + cutover (၂–၃ ရက်)
- [ ] User 18 ယောက်ကို Cognito ထဲ import (`custom:profile_id` = ရှိပြီးသား id)
- [ ] **Password hash ရွှေ့လို့ မရပါ** → email 10 ယောက်ကို **password reset ပို့ရမယ်**
- [ ] Google 8 ယောက် — email နဲ့ တိုက်ပြီး auto-link
- [ ] Staging မှာ အပြည့်အဝ စမ်း → DNS/deploy cutover
- [ ] Supabase ကို read-only ထား (rollback အတွက် ၂ ပတ်)

**စုစုပေါင်း: ~၂၅–၃၆ ရက် (တစ်ယောက်တည်း အချိန်ပြည့်)**

---

## ၄။ ⛔ ယခု ပိတ်ဆို့နေတဲ့ အရာ (blocker)

### AWS account က SMS ပို့လို့ မရသေးပါ

```
$ aws sns get-sms-sandbox-account-status --region ap-southeast-1
ERROR: The AWS Access Key Id needs a subscription for the service
       (Service: PinpointSmsVoiceV2)
```
Region ၂ ခုလုံးမှာ တူတူ → **account အဆင့် ပြဿနာ**။

**လုပ်ရမည့်အဆင့်:**
1. AWS Console → **Billing** → payment method အတည်ပြု (account အပြည့် activate)
2. **AWS End User Messaging (Pinpoint SMS)** console ဖွင့် → region `ap-southeast-1`
3. **Sandbox ကနေ Production access** တောင်း (Support ticket) — use case ရေးရမယ်
4. မြန်မာ (+95) အတွက် **Sender ID** မှတ်ပုံတင် (တချို့နိုင်ငံမှာ မဖြစ်မနေ)
5. Spend limit သတ်မှတ် (ဥပမာ $50/လ)

> မြန်မာကို SMS ပို့ခြင်း — AWS က support လုပ်ပေမယ့် **sender ID / route
> အခြေအနေက နိုင်ငံအလိုက် ကွဲပြားတယ်**။ Production access ရပြီးရင်
> နံပါတ်တစ်ခုကို **test ပို့ကြည့်ပြီးမှ** အားကိုးသင့်ပါတယ်။
> မရရင် အရန်: Twilio / ပြည်တွင်း SMS aggregator (Cognito custom SMS sender
> Lambda နဲ့ ချိတ်လို့ရတယ်)။

---

## ၅။ အန္တရာယ် စာရင်း

| အန္တရာယ် | အဆင့် | ကာကွယ်နည်း |
|---|---|---|
| Password 10 ယောက် ရွှေ့မရ | မြင့် | Reset email ကြိုပို့၊ user တွေကို ကြိုပြော |
| RLS 153 ခု ပျက်ခြင်း | မြင့် | `auth.uid()` shim + policy test script |
| Realtime မလုပ်ခြင်း (call/chat) | မြင့် | Phase 4 ကို staging မှာ အပြည့် စမ်း |
| Media URL အားလုံး ပျက် | မြင့် | S3 ကူးပြီးမှ DB path migrate |
| RDS စရိတ် | နိမ့် | db.t4g.micro (free tier 12 လ) |
| Cutover မှာ downtime | အလယ် | Maintenance window + rollback plan |

---

## ၆။ Rollback

Phase 6 cutover မတိုင်ခင်အထိ **Supabase က production ဆက်ဖြစ်နေမယ်**။
Cutover ပြီးရင် ၂ ပတ်အထိ Supabase ကို read-only ထားပြီး၊ ပြဿနာဖြစ်ရင်
DNS/deploy ကို ပြန်လှည့်ရုံနဲ့ ပြန်ရနိုင်တယ်။

---

## ၇။ နောက်တစ်ဆင့်

1. **AWS SMS activate** (အထက်ပါ ၅ ဆင့်) ← သင် လုပ်ရမည်
2. Phase 1 (Cognito) စတင် ← ကျွန်တော် လုပ်နိုင်ပြီ
3. Phase 2 (RDS) — ကုန်ကျစရိတ် အတည်ပြုပြီးမှ
