# gwave.ai — Deploy Checklist (production live လုပ်ရန်)

နောက်ဆုံး main ကို production ဖြစ်အောင် အဆင့်လိုက် —

## ၁။ Database migration (Supabase SQL Editor)

`gwave-MASTER-run-once.sql` (chat မှာ ပို့ထားသည်) ကို **တစ်ကြိမ်** run ပါ။
ကျန်နေသေးသမျှ အားလုံး ပါပြီး — အောက်ဆုံးမှာ PASS/FAIL ဇယား ထွက်မည်။
ဖိုင်ထဲပါ —

- Course completion certificates
- လောင်းကစား (wager) ဖယ်ရှား + ငွေပြန်အမ်း
- Push notification subscriptions
- Learn leaderboard
- Shop order delivery tracking
- Admin analytics RPC

> idempotent မို့ ထပ် run လည်း ဘေးကင်း။ ၈ ချက်စလုံး `PASS ✅` ဖြစ်ရမည်။

## ၂။ Environment variables (AWS server `.env`)

ရှိပြီးသား Supabase/Stripe/Mux env များအပြင် အသစ် —

```
# Web Push — chat မှာ ပို့ထားတဲ့ gwave-VAPID-keys.env ထဲက တန်ဖိုးများ
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:hello@gwave.ai

# Play Store TWA — bubblewrap build ပြီးမှ ထည့် (docs/PLAY_STORE.md)
TWA_PACKAGE_NAME=ai.gwave.app
TWA_SHA256_FINGERPRINT=...
```

## ၃။ Redeploy (AWS server — manual)

gwave.cc က AWS server (self-hosted Docker) ပေါ်မှာ run နေတာမို့ deploy က
**auto မဟုတ်ပါ** — server ထဲ ဝင်ပြီး အောက်က command ကို **လက်နဲ့ run** ရမည် —

```
cd gwave.ai
git pull
bash deploy/server-deploy.sh
```

ဒါက နောက်ဆုံး `main` ကို ဆွဲ၊ Docker image ကို ပြန်ဆောက်ပြီး restart လုပ်တယ်။
ပြီးမှ ဖုန်း/browser မှာ hard refresh (Ctrl+Shift+R) လုပ်ပါ။

> ⚠️ ဒီ manual deploy မ run မချင်း website မှာ update အသစ်တွေ (ဘာသာစကား၊
> feature အသစ်) မပေါ်ပါ — code က GitHub ရောက်ရုံနဲ့ live မဖြစ်သေးပါ။

## ၄။ စစ်ဆေးရန် (deploy ပြီးနောက်)

- `/welcome` — logged-out မှာ landing page ပေါ်လာသည်
- Settings → Notifications → "ဖွင့်မည်" — push subscribe ဖြစ်ပြီး
  တစ်ခြား device ကနေ message ပို့ကြည့် → notification ရသည်
- `/learn/leaderboard` — အဆင့်ဇယား
- Shop order — status ပြောင်းရင် ဝယ်သူဆီ timeline + push
- `/admin` — DAU/MAU/order/lesson metric row
- Messenger ဂိမ်း — chess/ကျားထိုး/ဆယ်ကွက် (လောင်းကြေး မပါ)

## ၅။ Play Store (optional — docs/PLAY_STORE.md)

- Feature graphic 1024×500: `public/play-feature-graphic.svg`
  (chat မှာ PNG အသင့်ပို့ထားသည်)
- App icon 512×512: `public/icon-512.png`
- `bubblewrap build` → `.aab` → Play Console upload
- Content rating: gambling မေးခွန်း "No" (လောင်းကစား ဖယ်ပြီး)

## ၆။ Recovery / အကောင့် email များ တကယ် ရောက်အောင် (SMTP — မဖြစ်မနေ)

Supabase ရဲ့ built-in email က **စမ်းသပ်ရေးသက်သက်** (တစ်နာရီ ၂–၃ စောင်သာ၊
deliverability မသေချာ) မို့ — password reset / signup email တွေ တကယ်ရောက်ဖို့
**custom SMTP** ချိတ်ပါ။

1. Supabase Dashboard → **Project Settings → Auth → SMTP Settings** → Enable
2. အလွယ်ဆုံး ရွေးချယ်စရာ ၂ ခု —
   - **Resend** (အခမဲ့ ၃၀၀၀ စောင်/လ): resend.com မှာ account ဖွင့် → API key ယူ →
     Host `smtp.resend.com`, Port `465`, User `resend`, Password = API key
   - **Gmail**: Google Account → Security → 2-Step Verification ဖွင့် →
     App passwords မှာ password ထုတ် → Host `smtp.gmail.com`, Port `465`,
     User = သင့် gmail, Password = app password
3. Sender email/name ဖြည့် → Save
4. **Auth → URL Configuration** မှာ —
   - Site URL: `https://gwave.cc`
   - Redirect URLs: `https://gwave.cc/auth/callback` နဲ့
     `https://www.gwave.cc/auth/callback` ထည့်
   - ⚠️ Site URL မှားရင် Google login ပြီးတာနဲ့ အဲဒီ URL ဆီ ပြန်ပို့ခံရမယ် —
     redirect URL က allowlist ထဲ မရှိရင် Supabase က Site URL ကို သုံးလို့ပါ
5. (optional) **Auth → Email Templates → Reset Password** မှာ စာသား မြန်မာလို ပြင်
6. App env: `NEXT_PUBLIC_SITE_URL=https://gwave.cc` (build arg) သတ်မှတ်ပြီး redeploy
