# AVATAR + AR/VR — Detailed Spec (implemented)
gwave-drone package ထဲ ထည့်ပြီးသား function များ၏ အသေးစိတ်

---

## 1. 3D Scan Avatar Pipeline

```
gwave app camera scan → GLB (Mixamo-compatible rig)
→ Avatar.loadScan(url | File)
   ├── rig ရှိ (Hips bone တွေ့) → SCAN_RIGGED — motion အပြည့်လှုပ်
   ├── rig မရှိ → SCAN_STATIC — static ပြ (production: auto-rig Lambda)
   └── height auto-normalize → 1.7m
Fallback: procedural mannequin (bone 20 ချောင်း, Mixamo naming)
```
- **Bone matching:** `mixamorig:Hips` / `mixamorigHips` / `Hips` fuzzy match — Mixamo, ReadyPlayerMe, Blender rig အားလုံးမိ
- **Load နည်း ၂ မျိုး:** Settings → "Scan GLB ဖိုင်တင်ရန်" file input, သို့ `?avatar=https://…/scan.glb` URL param (production: S3 avatar URL ကို Cognito profile ကထည့်)
- DRACO decoder CDN ချိတ်ပြီးသား — compressed scan GLB တင်လို့ရ

## 2. Motion System (Motions.js) — အသေးစိတ်

**Architecture:** procedural pose functions + state machine + 180ms crossfade blending + layer ၃ ထပ်
```
Locomotion state (full body) → AIM layer (upper-body mix) → HEAD_LOOK layer → BREATHING layer
```

### State catalog
| State | အသေးစိတ်လှုပ်ရှားမှု |
|---|---|
| **IDLE** | အသက်ရှူ ရင်ဘတ်လှုပ် (2.1Hz), ကိုယ်အလေးချိန် ဘယ်ညာရွှေ့ (0.7Hz), ခေါင်း ခဏခဏ လှည့်ကြည့် |
| **WALK** | speed-based gait (2Hz@1.5m/s): ပေါင်လွှဲ ±31°, swing phase ဒူးကွေး, ခြေဖဝါး heel-toe roll, လက် counter-swing + တံတောင်ကွေး, hip rotation+sway, ရင်ဘတ် counter-rotate, gait bob 2.5cm |
| **RUN** | 3Hz, ရှေ့ကိုင်း 12°, ပေါင် ±49°, တံတောင်ကွေးကိုင်, hip bob 5cm + bounce |
| **CROUCH** | hips −42cm, ဒူးအပြည့်ကွေး, ခေါင်းမော့ကြည့် |
| **CROUCH_WALK** | crouch pose + နှေးနှေးလှမ်း overlay |
| **JUMP** | 3-phase: ဆောင့်ကြောင့် (0.12s) → ခုန်တက် လက်မြှောက် → ဆင်း absorb |
| **PILOT_SIT** | ဒူးထောက်ထိုင် (−50cm), goggles ငုံ့ကြည့် + ယမ်း, radio ကိုင်လက် ၂ ဖက် တံတောင်ကွေး, **လက်မ gimbal micro-movement** (stick ကစားနေသလို 5Hz) |
| **WAVE** | ညာလက်မြှောက် လက်ဝှေ့ (6Hz), ခေါင်းစောင်း |

### Layers
- **AIM (weight 0..1):** locomotion ပေါ် upper-body override — ညာလက်သေနတ်ဆန့်, ဘယ်လက် foregrip, ရင်ဘတ် −16° target ဘက်လှည့်, ခေါင်း sight ထဲကြည့် → **လမ်းလျှောက်ရင်း ချိန်လို့ရ**
- **HEAD_LOOK:** world-space target look-at, yaw clamp ±70°, pitch ±52°, ခေါင်း 70% + ရင်ဘတ် 30% ခွဲလှည့် (FPV mode မှာ pilot က drone ကို အလိုအလျောက် လိုက်ကြည့်နေ)
- **BREATHING:** always-on, RUN မှာ ×3 ပြင်း

**Game loop wiring (main.js):** WASD/stick → camera-relative heading, yaw smooth-turn (10/s), Shift=RUN, C=CROUCH, Space=JUMP, **F = drone deploy** → avatar PILOT_SIT + FPV mode ပြောင်း, drone က avatar ရှေ့ 1.2m မှာ spawn

## 3. VR (WebXR immersive-vr)

| Feature | Implementation |
|---|---|
| Entry | `🥽 VR` button (support auto-detect), local-floor reference space |
| **SCREEN mode** (default, comfort) | FPV view ကို WebGLRenderTarget 1280×720 → မျက်နှာရှေ့ 2.2m floating 16:9 screen, headset yaw လိုက်, comfort grid room — **motion sickness မဖြစ်** |
| **FULL mode** (experienced) | XR rig ကို drone pose တိုက်ရိုက်တပ် — true FPV immersion, camera uptilt ပါ |
| Controls | VR controller thumbsticks = radio gimbals (Mode 2: L=THR/YAW, R=PITCH/ROLL), **grip = ARM** |
| Haptics | per-hand pulse — crash ညာလက်ပြင်း, motor hum ဘယ်လက် |

## 4. AR (WebXR immersive-ar)

- `📱 AR` button → phone camera passthrough (Android Chrome / ARCore)
- **hit-test** → ကြမ်းပြင်/စားပွဲပေါ် ring reticle → tap = **Drone Valley တစ်ခုလုံး 1:50 miniature ချ**
- world group scaling architecture — physics မပြောင်းဘဲ world ကို scale (drone က miniature ထဲပျံ)
- DOM overlay — OSD က AR ထဲမှာပါ ပေါ်
- Session end → world scale/position auto-restore

## 5. Production hooks (P7 ချိတ်ရန်)
- `Avatar.loadScan(profile.avatar_glb_url)` ← Cognito user attributes
- Scan upload API: `POST /avatar/scan` → S3 → auto-rig batch → `user_avatars` RDS row
- Motion system သည် server-side animation data မလို — state + phase သာ netcode နဲ့ sync (bandwidth သက်သာ)
- NPC/remote players — Avatar+Motions instance စီသုံး, state ကို snapshot ကလာ
