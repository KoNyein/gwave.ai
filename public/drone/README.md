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

## Next (P2 hooks)
- Drone mesh ကို GLB နဲ့လဲ (`buildDroneMesh()` → GLTFLoader)
- Config save → RDS `game.drone_configs` (localStorage placeholder ကို API call လဲ)
- Rapier collision (gates/barrels), gate timing system, ghost replay
- Cognito SSO + gwave.cc iframe/route embed: `game.gwave.cc/drone`
