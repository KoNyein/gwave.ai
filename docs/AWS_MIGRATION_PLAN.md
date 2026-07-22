# Supabase → AWS ပြောင်းရွှေ့ရေး အစီအစဉ်

**ရည်မှန်းချက်:** Auth (SMS provider အပါအဝင်) နဲ့ backend တစ်ခုလုံးကို AWS
infrastructure ထဲ ပြောင်းရန်။ Supabase ကို လုံးဝ ဖြုတ်ရန်။

**ရေးသည့်ရက်:** 2026-07-14 · **ရေးချိန် အခြေအနေ:** Phase 0 (တိုင်းတာပြီး၊ အတည်ပြုစောင့်)

> ## ✅ အခြေအနေ (2026-07-21): migration **ပြီးဆုံးပြီး** — 2026-07-17 က cutover
> ဒီစာတမ်းက **ရေးဆွဲစဉ်က အစီအစဉ်** (သမိုင်းမှတ်တမ်း)။ အောက်ပါ အပိုင်းများကို
> ဖတ်တဲ့အခါ ယနေ့ တကယ် run နေတဲ့ stack က —
>
> - **Auth:** Amazon Cognito (+ app က ကိုယ်ပိုင် သက်တမ်းတို **ES256 data token**
>   mint လုပ်ပြီး `sub` = `profiles.id`, `role` = `authenticated`)
> - **DB:** RDS PostgreSQL (RLS policy တွေ အတိုင်း ဆက်သုံး)
> - **Data API:** ကိုယ်ပိုင် **self-hosted PostgREST + Realtime** (`https://gwave.cc/sb`) —
>   အစီအစဉ်ထဲက "ကိုယ်ပိုင် pg/Drizzle data layer" နဲ့ "ကိုယ်ပိုင် WebSocket service"
>   အစား၊ ဒါကြောင့် **ဖိုင် ၁၅၁ ခု ပြန်ရေးစရာ မလိုခဲ့ပါ** —
>   `@supabase/supabase-js` က PostgREST client ဖြစ်လို့ AWS endpoint တွေနဲ့ တိုက်ရိုက် ကိုက်
> - **Storage:** S3 + CloudFront · **Hosting:** ECR image တစ်ခုကို EC2 ပေါ်မှာ run
>
> **Supabase project မရှိတော့ပါ** (hosted Google OAuth client အပါအဝင် သေပြီး)။

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
- [ ] `src/lib/supabase/*` → ကိုယ်ပိုင် data layer (pg pool + per-request `SET LOCAL`)
      — *တကယ်လုပ်ခဲ့တာ:* `src/lib/supabase/*` → **`src/lib/data/*`**၊ PostgREST
      client ကိုပဲ ဆက်သုံး (pg pool မလိုတော့)
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

## ၄။ SMS — စမ်းသပ်ပြီးသား ရလဒ် (2026-07-14)

Account က AWS ရဲ့ **Free plan** ဖြစ်နေလို့ SMS လုံးဝ ပိတ်ထားခဲ့တယ်
(EC2 မှာ free-tier instance type တွေပဲ ရခဲ့တာလည်း ဒီအကြောင်းရင်းပါပဲ)။
**Paid plan upgrade ပြီးနောက် SMS API အလုပ်လုပ်တယ်။**

### 🔴 ဒါပေမယ့် — **မြန်မာကို မရောက်ပါ**

| နိုင်ငံ | နံပါတ် | ရလဒ် |
|---|---|---|
| 🇹🇭 ထိုင်း | +66 990901078 | ✅ **ရောက်တယ်** (OTP စာသား အဆုံးအထိ ရောက်) |
| 🇲🇲 မြန်မာ | +959 265056193 | ❌ **မရောက်** |
| 🇲🇲 မြန်မာ | +959 666883138 | ❌ **မရောက်** |

Sender ID / origination number မလိုဘဲ AWS default နဲ့ ပို့လို့ရတယ်
(~$0.03/စောင်)။ ဒါပေမယ့် **မြန်မာ carrier route မရှိပါ**။

### ဆုံးဖြတ်ချက်: SMS ကို AWS ပြင်ပ provider နဲ့ ပို့မယ်

**Cognito ကို ဆက်သုံးမယ်** — Cognito မှာ **Custom SMS Sender Lambda** ဆိုတာ
ရှိတယ်။ OTP ကို Cognito ကပဲ ထုတ်ပြီး၊ **SMS ပို့တာကိုပဲ** ပြင်ပ provider ကို
လွှဲပေးလိုက်တာပါ။ **ကျန်တဲ့ migration plan အားလုံး မပြောင်းရပါ။**

```
Cognito (OTP ထုတ်)
   └─▶ Custom SMS Sender Lambda (KMS decrypt)
          └─▶ Twilio / ပြည်တွင်း aggregator ─▶ 📱 +95
```

**Provider ရွေးချယ်စရာ:**
| | အားသာချက် | အားနည်းချက် |
|---|---|---|
| **ပြည်တွင်း aggregator** (MPT/Ooredoo partner) | မြန်မာမှာ **အယုံကြည်ရဆုံး**, စျေးသက်သာ | ကိုယ်တိုင် စာချုပ်ချုပ်ရ |
| **Twilio** | ချက်ချင်း စလို့ရ, API ကောင်း | မြန်မာ delivery **အာမမခံ**, စျေးကြီး |
| **SMS မသုံးဘဲ** (email + Google) | **အခုချက်ချင်း ရ**, စရိတ်မရှိ | ဖုန်းနံပါတ်နဲ့ login မရ |

> **အကြံပြုချက်:** email + Google နဲ့ အရင်စတင်ပြီး၊ ပြည်တွင်း aggregator
> account ရမှ SMS OTP ထပ်ဖြည့်ပါ။ SMS မရှိလို့ migration ရပ်စရာ မလိုပါ။

### AWS SMS ကို ထိုင်း/နိုင်ငံတကာ user တွေအတွက် ဆက်ထားနိုင်တယ်
ဒါပေမယ့် production အတွက် — **Sandbox ကနေ ထွက်ရမယ်** (Request production
access) + **spend limit တင်ရမယ်** (အခု $1/လ)။

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
