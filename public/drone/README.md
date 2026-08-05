# GWAVE DRONE — FPV Simulator + Avatar + AR/VR
three.js FPV drone physics + controller (FeelFPV-parity) · GWAVE_METAVERSE_COMBAT.md spec ရဲ့ P1 implementation

## Run နည်း
```bash
cd gwave-drone-p1
npx serve .        # သို့ python3 -m http.server 8000
# browser: http://localhost:8000  (Chrome/Edge recommended)
```
> `file://` နဲ့ တိုက်ရိုက်ဖွင့်လို့မရ — ES modules ကြောင့် local server လိုသည်။

## Controls
| Input | Action |
|---|---|
| **Space** / Gamepad **A** | ARM / DISARM |
| **R** / Gamepad **B** | Reset |
| **M** / Gamepad **Y** | ACRO ↔ ANGLE mode |
| **Esc** / ⚙ button | Settings panel |
| W/S | Throttle (keyboard) |
| A/D | Yaw · Arrows = Pitch/Roll |
| Gamepad | Mode 2 default (L=THR/YAW, R=PITCH/ROLL) |
| Touch (mobile) | Dual virtual sticks |

**Real ELRS radio:** RadioMaster/BetaFPV radio ကို USB joystick mode နဲ့ချိတ် → browser က gamepad အဖြစ်မြင် → Settings ထဲ **AUTO BIND** နှိပ်ပြီး stick ၄ ချောင်း တစ်ခုချင်း လှုပ်ပြပါ။

## Files
```
index.html          — OSD (betaflight-style) + settings panel + touch sticks
src/config.js       — defaults: rates 200/600/0.40, 650g, cam 30°, FOV 70°
src/DronePhysics.js — 240Hz sim: Actual Rates, rate PID (I-relax, FF),
                      motor mixing + air mode, motor lag, battery sag,
                      ground effect, prop wash, drag, ANGLE mode, crash
src/Controller.js   — gamepad/ELRS + auto-bind wizard + keyboard + touch
src/SettingsUI.js   — rates steppers + live rate-curve graph + invert/half-throttle
src/main.js         — Drone Valley world, FPV camera, fixed-step loop, haptics
```

## Physics verified (headless test)
- `actualRate(0.5)` = 225°/s, `actualRate(1.0)` = 600°/s ✓
- Full roll stick → gyro tracks −596°/s ✓
- Throttle punch → voltage sag 25.2→23.7V ✓
- Throttle cut → air mode keeps control ✓

## New: Avatar + AR/VR
- **[F]** = AVATAR (3rd person) ↔ DRONE (FPV) ပြောင်း — pilot ထိုင်ပြီး goggles ကြည့်နေပုံ motion ပါ
- Avatar: WASD=လမ်းလျှောက် · Shift=ပြေး · C=ဒုံး · Space=ခုန် · mouse drag=camera
- Scan GLB: Settings → file တင် သို့ `?avatar=URL` (Mixamo rig → motion အပြည့်)
- **VR**: 🥽 button — SCREEN comfort mode / FULL FPV, thumbsticks=gimbals, grip=ARM
- **AR**: 📱 button — tap ချပြီး valley miniature 1:50 (Android Chrome)
- အသေးစိတ်: `AVATAR_XR_SPEC.md`

## Phase 2 — Racing Complete (implemented)
- **Lap timing (2.1):** ARM = race start · gate ဖြတ်ကြောင်း segment-plane detection (direction + order စစ်) · Race time / Lap 1-2 / Best OSD panel · next gate အစိမ်းရောင်ပြ
- **Collision (2.2):** barrels/trees/gate posts — 3.5m/s ကျော်တိုက်ရင် crash, နှေးရင် bump/bounce
- **GLB drone (2.3):** `?drone=URL` သို့ `./assets/drone.glb` ရှိရင် auto-load (prop1..4 node spin), မရှိရင် procedural
- **Sound (2.4):** motor 4 လုံး physics-driven synth (throttle→pitch), arm/disarm/gate beeps, low-battery beep, crash noise
- **Ghost (2.5):** best lap semi-transparent ghost drone ပြန်ပျံ (20Hz keyframes + slerp)
- **Track format (2.6):** `src/race/track_valley.js` — gates/spawn/laps JSON schema (editor-ready)

## Phase 3 — Soldier FPS Core (implemented)
- **Controller (3.1):** walk 4.2 / sprint 6.8 (stamina 8s) / crouch 1.8 m/s, jump+gravity, obstacle push-out, smooth crouch eye height
- **FPS camera (3.2):** pointer lock mouse look, head bob (ADS မှာလျော့), procedural gun viewmodel + sway + ADS position lerp + FOV zoom
- **Weapons (3.3):** AK-47 / M4 / Glock / Kar98 data-driven — RPM, mag/reserve, reload, CS-style recoil pattern arrays (spray up→right drift, ADS ×0.62), hip/ADS spread + movement penalty, hitscan raycast + tracer + muzzle flash light
- **Sniper ballistics (3.4):** projectile sim — muzzle 760 m/s, gravity drop, segment-sphere hit test
- **Target range (3.5):** silhouette targets ၆ ခု (headshot zone ★×2.3), damage numbers float, hit flash, လဲကျ + 3s respawn, hitmarker ✕ + sound
- **Mode cycle (3.6):** SOLDIER (1st person) ↔ [F] drone deploy (soldier ရှေ့ spawn) ↔ ပြန်ဆင်း · V = 3rd person (avatar aim-layer နဲ့ပြ)
- **Feedback (3.7):** gunshot synth (crack+thump per gun), reload clicks, per-gun haptics

## Phase 4 — NPC AI + Combat Systems (implemented)
- **Enemy AI (4.1+4.2):** PATROL→COMBAT→COVER→INVESTIGATE states, LoS (သစ်ပင်/barrel ကွယ်), cover-point scoring + peek-shoot cycle, obstacle steering, difficulty tiers (reaction 0.18–0.45s, aim error cone), avatar+motions နဲ့ animate, ရန်သူအနီရောင် — **[P] = wave mode** (wave တက်တိုင်း ခက်လာ)
- **ဗုံးထောင် (4.3):** [4]=Mine (3s arm, ၁.၃m trigger) · [5]=Tripwire (stake ၂ ချက်, segment crossing) · [6]=C4 + [G]=remote detonate
- **ကားပေါက်ကွဲမှု (4.4):** ကား ၃ စီး + red barrels — HP→SMOKE→FIRE→countdown→**ပေါက်ကွဲ** AoE, barrel→car chain explosion, wreck mesh
- **မီး (4.5):** fire grid 2m cells, 40% spread ticks, burn damage 0.5s tick (player+ရန်သူ), ကားပေါက်ကွဲရင် မီးပတ်လောင်
- **ခွေး (4.6):** senses (အသံ 40m/အနံ့ 25m/အမြင် 30m), ALERT ဟောင်ရင် ရန်သူတွေ player position သိ, CHASE 8.5m/s + ကိုက် 15dmg + stumble, **mine အနံ့ခံ sniff+ဟောင်**, trot/tail animation
- **Explosion VFX (4.7):** fireball + shockwave ring + smoke + spark particles + debris + camera shake + haptics
- **Burmese VO (4.8):** caption system + radio beep — wave/ရန်သူတွေ့/ခွေးသတိပေး/kill callouts (audio file hooks ready)
- Player: HP bar + damage vignette + 5s ပြီးမှ regen + heartbeat haptic (HP<25) + death/respawn

## Phase 6 — Kamikaze / Scout Drone Combat (implemented)
- **Kamikaze payload (6.1):** [F] deploy → **30m ပျံမှ ARM** (OSD: SAFE→ARMED ⚠) → crash = ပေါက်ကွဲ (radius 6, dmg 220 + မီး) · [G] = manual detonate · fuse modes IMPACT/PROXIMITY/MANUAL · ပေါက်ပြီးရင် **10s rebuild cooldown** + soldier auto-return
- **Video link (6.1):** distance + occlusion (သစ်ပင်/အဆောက်အအုံကွယ်) → **static noise overlay + RSSI ကျ** · link < 8% ၂ စက္ကန့် = failsafe crash
- **Scout marking (6.2):** camera center ကို ရန်သူပေါ် 1s ထား → အနီ marker 8s (progress % OSD)
- **Counters (6.3):** ရန်သူတွေက drone ကို ပြောင်းပစ် (drone HP 25, hitbox သေး — ပစ်ခက်), drone အသံကြားရင် alert · **Jammer zone** (map အနောက်ဘက်) — အထဲဝင်ရင် signal ×0.12, jammer ကို ပစ်ဖျက်ရင် airspace ပွင့်
- Gameplay loop အပြည့်: mine ထောင် → wave ခေါ် → ရန်သူကို scout drone နဲ့ mark → kamikaze နဲ့ ထိုးစိုက် → ခွေးရှောင် → ကား/barrel chain ပေါက်ကွဲ

## Garage — Drone Configurator (implemented)
- **🔧 GARAGE button / [B]** — FeelFPV-style panel: Propellers (2/3/4/7-blade) · Motors (1700/1900/2400KV) · Battery (4S/6S, 1100–1800mAh) · Frame (3"/5"/7")
- **Part တိုင်း physics တကယ်ထိ:** thrust, drag, motor spool (tau), battery sag/voltage/capacity, arm length, inertia — stat card = physics တွက်ချက် အတိအကျ
- Spec sheet: Weight / TWR / Top speed / Flight time / Agility bars + build hint (မြန်မာ)
- Color zones: frame / props / battery, 💾 SAVE (localStorage → production: RDS game.drone_builds), 🚁 TEST FLY = build နဲ့ချက်ချင်း deploy
- Build ဥပမာ: Race (2-blade+2400KV) = TWR 6.5·76km/h·193s · Cine 7" = TWR 4.2·39km/h·372s · Micro 4S = TWR 7.3

## Phase 5 — Multiplayer Netcode Core (implemented)
**Run:**
```bash
cd server && npm install && node server.js     # ws://localhost:8787
# client: 🌐 ONLINE button (သို့ ?server=ws://host:8787)
# browser tab ၂ ခုဖွင့်ရင် တစ်ယောက်ကိုတစ်ယောက်မြင် + ပစ်လို့ရ
```
- **Server (authoritative):** room system (16 players), 30Hz snapshot tick, **envelope validation** (soldier 8.5 / drone 55 m/s ကျော်ရင် reject + snap-back correction), **lag-comp hit validation** (300ms position history rewind, claim ↔ rewound pos ≤1.2m), kill/respawn/killboard, chat, kamikaze boom relay
- **Client:** 20Hz state send, **100ms interpolation buffer** (remote avatars smooth), remote players = Avatar+Motions (အပြာ tint, anim state sync), remote drone mesh + PILOT_SIT pose, PvP (remote ကိုပစ်ရင် local raycast → server validate), kill feed captions (မြန်မာ)
- **Transport:** WebSocket — production: WebTransport datagrams (QUIC) upgrade — send/broadcast layer ၂ function ထဲသာရှိလို့ swap လွယ် (GAME_DESIGN_ANALYSIS §5.2)
- Verified: 2-bot integration test — join/snapshots/teleport-reject/3×34dmg→kill/invalid-claim-reject/respawn အားလုံး pass

## Phase 7 — gwave Integration (implemented, local-tested)
**Run (dev):**
```bash
cd server && npm install
AUTH_MODE=dev node api.js &     # REST API :8788 (memory store; DATABASE_URL → Postgres)
AUTH_MODE=dev node server.js    # game server :8787 (token လိုပြီ)
```
- **Cognito SSO (7.1):** `server/auth.js` — AUTH_MODE off/dev/cognito · Cognito JWKS verify + `custom:avatar_glb` claim · game join မှာ token မပါရင် reject
- **RDS schema (7.2):** `server/migrations/001_game_schema.sql` — players/matches/inventory/items/drone_builds + leaderboard view · `server/api.js` REST (pg ↔ memory auto)
- **Drone build sync (7.3):** Garage SAVE → `PUT /me/drone-config` ☁ · login မှာ cloud build auto-pull + apply
- **Avatar (7.4):** `/me` ရဲ့ avatarGlb (Cognito attribute) → scan GLB auto-load
- **Stats + leaderboard (7.5):** kill → server-to-server `/report` (GAME_KEY auth) → kills/xp · **[L]** = top 5 leaderboard
- **OpenClaw NPC (7.9):** စခန်းမှူး "ဦးလှ" NPC (spawn ဘေး, lookAt+wave) — **[T]** နဲ့စကားပြော → `?ai=` endpoint (offline = မြန်မာ fallback tips)
- Verified: auth reject/accept, config roundtrip, kill→stats (K1/XP25), leaderboard rank
- **Production:** `P7_DEPLOY.md` — Cognito/RDS/EC2/nginx/IVS/Marketplace/WebTransport checklist
- Drone mesh ကို GLB နဲ့လဲ (`buildDroneMesh()` → GLTFLoader)
- Config save → RDS `game.drone_configs` (localStorage placeholder ကို API call လဲ)
- Rapier collision (gates/barrels), gate timing system, ghost replay
- Cognito SSO + gwave.cc iframe/route embed: `game.gwave.cc/drone`
