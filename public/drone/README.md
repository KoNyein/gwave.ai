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

## Next (P5 hooks)
- Multiplayer netcode (WebTransport), STRIKE 5v5, kamikaze drone payload (explosion system ရှိပြီ — drone ချိတ်ရုံ)
- Drone mesh ကို GLB နဲ့လဲ (`buildDroneMesh()` → GLTFLoader)
- Config save → RDS `game.drone_configs` (localStorage placeholder ကို API call လဲ)
- Rapier collision (gates/barrels), gate timing system, ghost replay
- Cognito SSO + gwave.cc iframe/route embed: `game.gwave.cc/drone`
