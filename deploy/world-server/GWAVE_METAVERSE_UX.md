# 🏙️ GWAVE Yangon City Metaverse — UI/UX Master Design (v10)

**ဒီဇိုင်း အနှစ်ချုပ်** — gwave.cc မှာ login ဝင်တာနဲ့ Facebook-style feed မဟုတ်ဘဲ
**Cyber-Yangon City metaverse ထဲ တန်းရောက်** ။ System function **အားလုံး** ကို
ကမ္ဘာထဲက **နေရာ (District/Kiosk)** တစ်ခုစီအဖြစ်ရော ၊ **☰ Radial Menu** ကနေရော
နှစ်လမ်းလုံး သုံးနိုင်သည် — "လမ်းလျှောက်ပြီးသုံး" (immersive) နဲ့ "တစ်ချက်နှိပ်သုံး"
(convenient) နှစ်မျိုးလုံး ရအောင်။

---

## ၁။ Login → Metaverse Flow

```
gwave.cc ဖွင့် → Cognito login (ရှိပြီးသား auth)
  → /metaverse?server=wss://game.gwave.cc&token=<idToken>   (DEPLOY_AWS.md §၆)
  → 🌕 ရွှေတံခါး portal fly-through (landing — first visit သာ / ကျော်လို့ရ)
  → 🎬 ရွှေစေတီပတ် cinematic → "စတင်မည်"
  → 📍 Cyber-Yangon City — Central Plaza spawn (0, 0, 8)
  → နာမည် = gwave username ၊ GP/XP/inventory အလိုအလျောက်ပါလာ (Cognito sub key)
```

---

## ၂။ Yangon City — မြို့ပြ Zone Map (နေရာချထားမှု အတိအကျ)

```
                        (z အနုတ် = မြောက်ဘက်)
        ┌─────────────────────────────────────────────┐
        │            🛕 ရွှေစေတီ (0,-45) — landmark      │
        │                                             │
        │  📰 Open Wall        Civic Plaza             │
        │  (-16,4.5,-14)   🏆(-4,-8)   🎯(4,-8)        │
        │  📰kiosk(-14,-10)                            │
        │  📁(-11,-4)                    ☕POS(11,-4)   │
        │                                             │
        │  🧬 Avatar Studio(-8,2)   🛍️ Market(8,2)     │
        │                                             │
        │  🚪Portals:  🌱Farm(12,-20) 🏘️မဲဆောက်(-12,-20) │
        │      🌍ကိုယ်ပိုင်ကမ္ဘာ(12,8)  ⚔️Arena(0,16)     │
        │                                             │
        │            📍 SPAWN (0, 0, 8)                │
        └─────────────────────────────────────────────┘
```

**District များ**
| District | ပါဝင်သည့်အရာ | တည်နေရာ |
|---|---|---|
| **Central Plaza** | Spawn ၊ NPC ဦးလှ/မစန်း ၊ portal များ | ဗဟို |
| **Creator District** | 🧬 Avatar Studio (3D scan + presets) | အနောက် |
| **Market District** | 🛍️ Marketplace ၊ ☕ POS ကော်ဖီဆိုင် | အရှေ့ |
| **Civic Plaza** | 🏆 Hall of Fame ၊ 🎯 Quest Board ၊ 📁 Projects | မြောက် |
| **Media Wall** | 📰 Open Wall — feed ကို 3D နံရံကြီးပေါ် တိုက်ရိုက်ပြ | အနောက်မြောက် |
| **Gateways** | Farm ၊ မဲဆောက် ၊ Strike Arena ၊ ကိုယ်ပိုင်ကမ္ဘာ portals | ပတ်လည် |

---

## ၃။ System Function ↔ Metaverse Mapping (အားလုံး)

| System Function | ကမ္ဘာထဲက နေရာ | UI Surface | Hotkey |
|---|---|---|---|
| **3D Game Engine** | ကမ္ဘာတစ်ခုလုံး (three.js Engine core) | — | — |
| **3D Scanner** | 🧬 Avatar Studio kiosk | GLB file ချိတ် → ကိုယ့် avatar ဖြစ် | ☰→🧬 |
| **3D Avatar Creation** | 🧬 Avatar Studio | Preset ၆ မျိုး grid (screenshot app ပုံစံ) | ☰→🧬 |
| **Profile Room** | 🌍 ကိုယ်ပိုင်ကမ္ဘာ = profile room ၊ 👤 stats billboard ပါ | [B] Build Mode | ☰→🌍 |
| **Projects** | 📁 Projects kiosk | Holo card list panel | ☰ |
| **Open Wall** | 📰 Media Wall (in-world 3D) + panel | Feed holo cards | N |
| **Newsfeed** | 📰 Open Wall + [N] panel (`?feed=` API) | Holo cards | N |
| **Shop / Marketplace** | 🛍️ Market kiosk | Skins + ⛓️NFT + 🏆Trophy | I |
| **POS (ကော်ဖီဆိုင်)** | ☕ POS kiosk | 🎁 GP→code → pos-claim.html | I |
| **Leaderboard/Seasons** | 🏆 Hall of Fame kiosk | Tabs: အားလုံး/အပတ်/လ | L |
| **Quests** | 🎯 Quest Board kiosk | Progress bars + auto-claim | Q |
| **Game (STRIKE)** | ⚔️ Arena portal (အနီ) | FPS HUD | — |
| **Web3/NFT** | Market kiosk ထဲ ⛓️ ခလုတ်များ | MetaMask 🦊 | — |
| **Multiplayer/Chat** | Room-based presence (NPC-style labels) | Kill feed / toasts | — |

**အသုံးပြုနည်း စည်းမျဉ်း** — kiosk တစ်ခုစီမှာ ရောင်စုံ hologram (octahedron) လည်နေပြီး
အနီးရောက်လျှင် hint ပေါ် → **E** နှိပ် = သက်ဆိုင်ရာ panel ပွင့်။ Panel တစ်ချိန်မှာ
တစ်ခုသာ ပွင့် (closeAll) — မျက်နှာပြင် မရှုပ်စေရ။

---

## ၄။ Menu System ၃ လွှာ

**(က) ☰ Radial Menu** (screenshot app ရဲ့ gesture wheel ပုံစံ) — မျက်နှာပြင်အောက်ဗဟို
FAB → နှိပ်လျှင် function ၇ ခု ခြမ်းဝိုင်းပုံ ပွင့်ထွက် (🧬🛍️🎯📰🏆🌍⚔️)။
Touch/mouse နှစ်မျိုးလုံး ၊ [M] key နဲ့လည်းရ။ **Mobile မှာ အဓိက menu။**

**(ခ) World Kiosks** — function တိုင်း မြို့ထဲမှာ နေရာရှိ — လမ်းလျှောက်တွေ့ရင်း
သုံးရင်း မြို့နဲ့ရင်းနှီး (discovery UX)။

**(ဂ) Hotkeys** (desktop power users) — E / I / Q / N / L / M / B / F / X / R / Space / Shift

**Mobile layout** (screenshot app ပုံစံနှင့်အညီ) —
ဘယ်အောက် joystick ၊ ညာအောက် ခုန်/E/🔫 ၊ အောက်ဗဟို ☰ ၊
ထိပ်ဘယ် room name ၊ ထိပ်ညာ 🦊 wallet + 💰 GP

---

## ၅။ Panel Design Language ("ရွှေတံခါး" theme)

- Glass panel — blur + ရွှေ hairline ထိပ်စည်း (theme/gwave-theme.css tokens)
- Holo card — feed/projects (ရွှေ notch signature)
- ရွှေ = CTA/ခေါင်းစဉ် ၊ စိမ်းလဲ့ = အောင်မြင်/live ၊ cyan = info ၊ အနီ = combat
- Orbitron = GWAVE/ကိန်း ၊ Padauk = မြန်မာစာ
- Panel width ≤ 480px ၊ max-height 78vh scroll — ဖုန်း landscape အဆင်ပြေ

## ၆။ Avatar System Flow

```
Preset ရွေး (၆ မျိုး) → localStorage မှတ် → ချက်ချင်းပြောင်း
  ↘ 📷 3D Scanner GLB upload → ကိုယ်ပိုင် scan avatar
  ↘ 🛍️ Shop skin ဝယ် → server sync → အားလုံးမြင် (snapshot 'c')
  ↘ ⛓️ NFT mint → blockchain ပိုင်ဆိုင်မှု
```

## ၇။ Profile Room = ကိုယ်ပိုင်ကမ္ဘာ

ကမ္ဘာထဲဝင်လျှင် 👤 billboard မှာ ပိုင်ရှင်နာမည် + XP/K/D/HS + GP/Items
(stats API မှ live fetch) ။ [B] Build Mode — block ၅ + GLB props ၃ + NPC ။
`?world=<key>` link က profile page link နဲ့ အတူတူ — social share လုပ်လို့ရ။
