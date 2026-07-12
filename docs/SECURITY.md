# gwave.ai — Security posture

hacker များ system ကို အလွယ်တကူ မထိုးဖောက်နိုင်ရန် အလွှာပေါင်းစုံ (defense in
depth) ဖြင့် ကာကွယ်ထားသည်။ ဒီစာတမ်းက ယခု ship ဖြစ်ပြီးသား ကာကွယ်မှုများနှင့်
နောက်ဆက်တွဲ လုပ်ဆောင်ရန်များကို စုစည်းထားသည်။

---

## 1. Authentication & sessions

- **Supabase Auth** (email/password + Google OAuth). စကားဝှက်များကို ကျွန်ုပ်တို့
  server မှ တိုက်ရိုက် မကိုင်ပါ — Supabase က salted/hashed သိမ်းသည်။
- OAuth / recovery redirect များကို **request header မှ derive လုပ်သော origin**
  ဖြင့်သာ ဆောက်သည် (`siteOrigin()`), open-redirect မဖြစ်စေရန်။
- **Rate limiting** — login / register / recovery တို့တွင် per-window ကန့်သတ်
  (`checkAuthRateLimit`), brute-force / credential-stuffing ကို တားသည်။
- **Sign out everywhere** — Settings → Account Security မှ refresh token
  အားလုံးကို global scope ဖြင့် ရုပ်သိမ်းနိုင် (compromise ဖြစ်ပါက)။
- Password change ကို session ရှိမှသာ ခွင့်ပြု; recovery flow သည် emailed
  link ၏ session ဖြင့်သာ။

## 2. Authorization — Row Level Security (RLS)

- Table **တိုင်း** တွင် RLS ဖွင့်ထား; policy များက `auth.uid()` အပေါ်
  အခြေခံ၍ owner/admin ကိုသာ ခွင့်ပြုသည်။
- Admin-only လုပ်ဆောင်ချက် (G-Pay status, top-up, currency rate) များကို
  **`security definer` RPC** များအတွင်း `is_admin()` စစ်ဆေးမှ ဆောင်ရွက်သည် —
  client မှ balance/status ကို တိုက်ရိုက် မပြင်နိုင် (guard trigger)။
- Private **storage buckets** (`slips`: KPay slip + KYC face) — owner နှင့်
  admin သာ ဖတ်နိုင်; upload ကို ကိုယ့် folder (`{uid}/…`) အတွင်းသာ ကန့်သတ်။

## 3. Transport & HTTP headers (`next.config.mjs`)

- **Content-Security-Policy** — `default-src 'self'`; script/style/img/connect
  များကို self + Supabase + allow-list ထားသော origin များသာ။ `object-src
  'none'`, `frame-ancestors 'none'` (clickjacking), `base-uri`/`form-action
  'self'`, `upgrade-insecure-requests`။
- **HSTS** `max-age=2y; includeSubDomains; preload` — HTTPS သာ။
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- **Permissions-Policy** — camera/mic/geolocation ကို same-origin သာ;
  payment/usb/sensors/FLoC ကို ပိတ်။
- `Cross-Origin-Opener-Policy`, `Origin-Agent-Cluster`,
  `X-DNS-Prefetch-Control: off`, `X-Permitted-Cross-Domain-Policies: none`.

## 4. Input & data handling

- Server action **တိုင်း** input ကို **zod schema** ဖြင့် validate;
  client-side check ကို မယုံ။
- SQL — Supabase client (parameterised) + `security definer` function များတွင်
  `format %I` / typed argument သုံး၍ **SQL injection** ကာကွယ်။
- XSS — React default escaping; `dangerouslySetInnerHTML` ရှောင်;
  user code (learn playground / games) ကို **sandboxed iframe** အတွင်းသာ။
- G-Pay **KYC** — full name + NRC + phone + face scan (liveness selfie)
  မပြည့်စုံဘဲ account မဖွင့်နိုင်; admin approval မှသာ ငွေလွှဲ ခွင့်ရ။

## 5. Secrets & infrastructure

- Service-role key ကို **server-only** (client bundle ထဲ ဘယ်တော့မှ မထည့်);
  browser client သည် anon key + RLS သာ။
- `.env` များ commit မလုပ်; provider (Vercel/Supabase) secret store သုံး။
- Health endpoint `/api/health`; developer API keys — scoped + rate-limited။

## 6. Client integrity

- Service worker minimal (push only, no asset cache) — stale/poisoned cache
  attack surface မရှိ။
- Settings → Software update — cache ရှင်း၍ newest server build ကို reload။

---

## Roadmap — deeper hardening

- **2FA / TOTP** (Supabase MFA) — high-value account (G-Pay) များအတွက်။
- Automated **RLS audit** + dependency scanning (CI) ကို release တိုင်း run။
- **WAF / bot mitigation** (Cloudflare) — L7 flood + scraping။
- Third-party **penetration test** — G-Pay wallet / crypto module မ live ခင်။
- Immutable **audit log** + anomaly alerting (login from new device/geo)။
- Secrets rotation policy + least-privilege service accounts။

> လုံခြုံရေး ချို့ယွင်းချက် တွေ့ပါက public issue မဖွင့်ဘဲ maintainer ကို
> တိုက်ရိုက် အကြောင်းကြားပါ (responsible disclosure)။
