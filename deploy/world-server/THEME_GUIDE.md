# 🎨 GWAVE Metaverse UI/UX — "ရွှေတံခါး" Theme Guide

Facebook-style UI ကနေ **metaverse-first** experience ကို ပြောင်းတဲ့ လမ်းညွှန်။
Design ရဲ့ အနှစ်ချုပ် — user က gwave.cc ဖွင့်တာနဲ့ **feed မမြင်ရသေးဘဲ ရွှေတံခါး
(Golden Gate) ကို ဖြတ်ပြီး metaverse ထဲ တန်းဝင်** ၊ feed/social က metaverse ထဲမှာ
holo panel အဖြစ် နေရာယူသည်။

## Design အနှစ်သာရ (ဘာကြောင့် ဒီပုံစံလဲ)

| အချက် | ရွေးချယ်မှု | အကြောင်းရင်း |
|---|---|---|
| **Identity** | ရွှေ (#f5c542) = ပင်မ accent | ရွှေစေတီ — Cyber-Yangon ကမ္ဘာနဲ့ တသားတည်း၊ generic cyberpunk အစိမ်း/ခရမ်း မဟုတ် |
| **Signature** | ရွှေတံခါး portal (landing hero) | "Metaverse ထဲဝင်ခြင်း" ကို စာမဖတ်ဘဲ မြင်တာနဲ့သိ |
| **Typography** | Orbitron (GWAVE/ကိန်း) + Padauk (မြန်မာ body) | Latin tech display + မြန်မာစာ ပေါင်းစပ်မှုက Gwave ရဲ့ ကိုယ်ပိုင်လက္ခဏာ |
| **Surface** | Glass panel (blur + glow hairline) | 3D ကမ္ဘာပေါ်တင်တဲ့ HUD ခံစားချက် — opaque card မဟုတ် |
| **Motion** | တစ်နေရာတည်း — portal ဖြတ်ပျံဝင်ခြင်း | effect ပြန့်ကျဲမနေဘဲ မှတ်မိစရာ တစ်ခုတည်း |

## ဖိုင်များ

```
landing/index.html      ← Homepage အသစ် (FB feed homepage အစားထိုး)
theme/gwave-theme.css   ← Design tokens + components (site တစ်ခုလုံးသုံးရန်)
index.html              ← ဂိမ်း shell (theme အတိုင်း restyle ပြီး + intro + feed)
```

## FB UI → Metaverse UI ပြောင်းဇယား

| Facebook-style ဟောင်း | ရွှေတံခါး အသစ် | Component |
|---|---|---|
| Homepage = feed list | Homepage = 3D portal → metaverse ထဲတန်းဝင် | `landing/index.html` |
| အပေါ်က navbar | အောက်ခြေ floating **dock** | `.g-dock` |
| အဖြူ post card | ရွှေ hairline ပါ **holo card** | `.g-card` / `.feedCard` |
| အပြာ button | ရွှေ gradient glow **button** | `.g-btn` |
| Feed = ပင်မစာမျက်နှာ | Feed = ဂိမ်းထဲ **[N] panel** | `hud.setFeedPanel` |
| Profile page | ကိုယ်ပိုင် **metaverse ကမ္ဘာ** [B] | UserWorldRoom |

## gwave.cc (Next.js) မှာ ချိတ်နည်း

**၁။ Theme သွင်း** — `theme/gwave-theme.css` ကို `app/globals.css` ထဲ import
(သို့) `<link>` ။ Component အားလုံး `g-` prefix မို့ ရှိပြီးသား CSS နဲ့ မတိုက်ပါ။

**၂။ Homepage ပြောင်း** — `app/page.tsx` ကို landing ဖြစ်အောင် —

```tsx
// နည်း ၁ — အလွယ်ဆုံး: landing ကို static serve ပြီး redirect
export default function Home() { redirect('/metaverse'); }

// နည်း ၂ — landing/index.html ကို public/ ထဲထည့်ပြီး
// next.config.js rewrites: { source: '/', destination: '/landing/index.html' }
```

**၃။ Feed ဟောင်းကို ရွှေ့** — `/feed` route မှာ ဆက်ထား (dock က link ချိတ်ပြီးသား)၊
API ရှိလျှင် ဂိမ်းကို `?feed=https://gwave.cc/api/feed` param ပေး —
[N] panel ထဲ တိုက်ရိုက်ပေါ်မည် (JSON: `{posts:[{who,when,text}]}`)။

**၄။ ကျန် page များ re-skin** — `.g-panel` `.g-card` `.g-btn` `.g-eyebrow` သုံးပြီး
တဖြည်းဖြည်း ပြောင်းသွားရုံ — tokens တူလို့ ဂိမ်းနဲ့ website က တသားတည်းမြင်ရမည်။

## User Flow အသစ်

```
gwave.cc ဖွင့် → 🌕 ရွှေတံခါး landing (3D, ကြယ်စင်, wireframe Yangon)
  → "Metaverse ထဲ ဝင်မည်" → portal ဖြတ်ပျံ ✨
  → ဂိမ်း load → 🎬 ရွှေစေတီပတ် cinematic ကင်မရာ
  → "စတင်မည်" နှိပ် → Cyber-Yangon ထဲ ရောက်
  → [N] Feed | [L] Board | [I] Shop | [Q] Quest | 🌍 ကိုယ်ပိုင်ကမ္ဘာ
```

## Accessibility

- `prefers-reduced-motion` — landing fly-through/pulse ပိတ်ပြီး တိုက်ရိုက် redirect
- `:focus-visible` ရွှေ outline — keyboard သုံးသူအတွက်
- Contrast — dim text (#8a97b8) ကို secondary သီးသန့်၊ အဓိကစာ #eaf0ff
