# gwave.ai ကို Google Play Store တင်နည်း (TWA)

gwave.ai သည် installable PWA ဖြစ်ပြီးသားမို့ **Trusted Web Activity (TWA)**
နည်းလမ်းဖြင့် code ပြောင်းစရာမလိုဘဲ Play Store app အဖြစ် ထုပ်ပိုးနိုင်သည်။
TWA ဆိုသည်မှာ Android app ခွံလေးထဲမှာ သင့် website ကို browser bar မပါဘဲ
အပြည့် ပြပေးခြင်း ဖြစ်သည် — feature အသစ်တင်တိုင်း Play Store ပြန်တင်စရာ
မလို၊ website update လုပ်ရုံပါပဲ။

## လိုအပ်ချက်များ

- Production domain (ဥပမာ `app.gwave.ai`) — HTTPS ဖြင့် live ဖြစ်နေရမည်
- [Google Play Console](https://play.google.com/console) account (တစ်ခါတည်း $25)
- Node.js 18+ နှင့် JDK 17 (bubblewrap က install ကူပေးသည်)

## အဆင့် ၁ — Bubblewrap ဖြင့် Android project ဆောက်ခြင်း

```bash
npm i -g @bubblewrap/cli

mkdir gwave-twa && cd gwave-twa
bubblewrap init --manifest=https://app.gwave.ai/manifest.webmanifest
```

မေးခွန်းများကို repo ရဲ့ `twa-manifest.json` ထဲက တန်ဖိုးများအတိုင်း ဖြေပါ —
- **Package ID**: `ai.gwave.app`
- **App name / launcher**: `gwave.ai` / `gwave`
- **Theme color**: `#3B6D11`, **Background**: `#EAF3DE`
- **Start URL**: `/feed`
- **Signing key**: `Create new` ရွေးပါ — keystore ဖိုင်နဲ့ စကားဝှက်ကို
  **လုံခြုံစွာ သိမ်းပါ** (ပျောက်ရင် app update တင်လို့ မရတော့ပါ)

## အဆင့် ၂ — Build

```bash
bubblewrap build
```

ရလဒ် —
- `app-release-signed.apk` — စက်ထဲ တိုက်ရိုက် စမ်းသွင်းရန်
- `app-release-bundle.aab` — Play Store တင်ရန် (ဒါကို သုံးပါ)

Build အပြီးမှာ keystore ရဲ့ **SHA-256 fingerprint** ကို ပြပေးသည်။
မပြရင် —

```bash
keytool -list -v -keystore android.keystore | grep SHA256
```

## အဆင့် ၃ — Digital Asset Links ချိတ်ခြင်း (အရေးအကြီးဆုံး)

ဒီအဆင့် မလုပ်ရင် app ဖွင့်တိုင်း browser bar ပေါ်နေပါမည်။

Server (Vercel/hosting) ရဲ့ environment variables မှာ ထည့်ပါ —

```
TWA_PACKAGE_NAME=ai.gwave.app
TWA_SHA256_FINGERPRINT=AA:BB:CC:...   (အဆင့် ၂ က SHA-256)
```

Deploy ပြီးရင် စစ်ပါ —

```bash
curl https://app.gwave.ai/.well-known/assetlinks.json
```

`package_name` နဲ့ `sha256_cert_fingerprints` ပါတဲ့ JSON ပြန်လာရမည်
(ဒီ route ကို `src/app/.well-known/assetlinks.json/route.ts` က ဆောင်ရွက်ပေးသည်)။

⚠️ Play Store က **Play App Signing** သုံးရင် Play Console →
Setup → App signing ထဲက **App signing key certificate** ရဲ့ SHA-256 ကို
fingerprint အဖြစ် ထည့်ရမည် (upload key မဟုတ်ပါ)။ နှစ်ခုလုံး ထည့်ချင်ရင်
comma ခံပြီး route ကို ချဲ့နိုင်သည်။

## အဆင့် ၄ — Play Console တင်ခြင်း

1. Play Console → **Create app** — အမည် `gwave.ai`, default language, Free
2. **Production → Create new release** → `app-release-bundle.aab` upload
3. Store listing ဖြည့် —
   - Screenshots: ဖုန်း ၂ ပုံ+ (feed, messenger, learn, shop)
   - Icon 512×512 (`public/icon-512.png` သုံးနိုင်)
   - Feature graphic 1024×500
4. **Content rating** မေးခွန်းများ ဖြေ — social/UGC app အဖြစ်
5. **Data safety** — စုဆောင်းတဲ့ data (account, message, location) မှန်ကန်စွာ ကြေညာ
6. Review တင် — ပုံမှန် ၁–၇ ရက် ကြာသည်

## အဆင့် ၅ — Update များ

- **Web feature အသစ်**: website deploy လုပ်ရုံ — app က အလိုအလျောက် ရ
- **Icon/name/color ပြောင်း**: `twa-manifest.json` ပြင် → `bubblewrap update`
  → `bubblewrap build` → `appVersionCode` တိုး → aab အသစ် တင်

## မှတ်ချက်များ

- iOS အတွက် — PWA ကို Safari ရဲ့ **Add to Home Screen** နဲ့ တိုက်ရိုက်
  သွင်းနိုင်ပြီးသား (App Store တင်ချင်ရင် နောက်တစ်ဆင့်အနေနဲ့ Capacitor သုံးနိုင်)
- WebRTC (calls/meet), camera, GPS, notifications — TWA ထဲမှာ Chrome
  engine အပြည့်မို့ အကုန် အလုပ်လုပ်သည်
- G-Pay လောင်းကြေး feature ပါသောကြောင့် Play Console content rating မှာ
  simulated gambling / real-money အမေးများကို ဂရုတစိုက် ဖြေပါ —
  ဒေသဆိုင်ရာ ဥပဒေနှင့် Play policy အလိုက် ကန့်သတ်ချက် ရှိနိုင်သည်
