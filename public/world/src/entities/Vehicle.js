// ============================================================
// Vehicle.js — 🛻 **ကား စီး/မောင်း** စနစ်
//
// user: "ကားတွေက စီးမရဘူး မောင်းမနေဘူး"
//
// ═══ ဘယ်လို သုံးလဲ ═══
//
//   ကားနား သွား → `E` (ဒါမှမဟုတ် touch ရဲ့ E ခလုတ်) → ဝင်စီး
//   joystick / WASD နဲ့ မောင်း — ရှေ့/နောက်, ဘယ်/ညာ ကွေ့
//   `E` ထပ်နှိပ် → ဆင်း (ကားဘေးမှာ ချပေးတယ်)
//
// ═══ ဒီဇိုင်း ဆုံးဖြတ်ချက်များ ═══
//
// ★ **Avatar ကို ဖျောက်ပြီး ကားကို မောင်းတယ်** — ကားထဲ ထိုင်နေတဲ့ ရုပ်
//   မပါဘူး (ရုပ်တွေမှာ ထိုင်တဲ့ animation က ကားခုံနဲ့ မကိုက်ဘူး)。
//   ကင်မရာက ကားနောက် လိုက်တယ်၊ လူက ကားထဲ ရှိတယ်လို့ သဘောထားတယ်။
// ★ **ကားရဲ့ collider ကို ဖြုတ်တယ်** မောင်းနေချိန် — မဟုတ်ရင် ကိုယ့်
//   ကားနဲ့ ကိုယ် တိုက်နေမယ်။ ဆင်းတဲ့အခါ ပြန်ထည့်တယ်။
// ★ **ရိုးရိုး physics** — ရှေ့တွန်းအား + ဘေးတိုက် ဆွဲငင်။ Rapier လို
//   အပြည့်အစုံ vehicle physics မလိုဘူး၊ ဒါက မြို့ထဲ လမ်းလျှောက်ရာမှာ
//   သုံးမယ့် ကားပါ၊ ပြိုင်ကားဂိမ်း မဟုတ်ဘူး။
// ★ **အသံ** — engine သံက speed အလိုက် အသံအမြင့် ပြောင်းတယ် (WebAudio
//   oscillator တစ်ခုတည်း — ဖိုင် မဆွဲရဘူး)。
// ============================================================

import * as THREE from 'three';

const MAX_SPEED = 16;        // m/s (~၅၈ km/h)
const ACCEL = 9;
const BRAKE = 18;
// ★ ဆွဲငင်အား — **MAX_SPEED ကို တကယ် ရောက်ဖို့** ချိန်ထားရမယ်。
//   `speed -= speed * DRAG * dt` ဆိုတော့ အမြင့်ဆုံး အရှိန်က ACCEL/DRAG。
//   DRAG ၁.၆ ဆိုရင် ၉/၁.၆ = **၅.၆ m/s** ပဲ ရတယ် — MAX_SPEED ၁၆ ဆိုတာ
//   ဘယ်တော့မှ မရောက်ဘူး၊ ကားက လမ်းလျှောက်တာထက် နည်းနည်းပဲ မြန်တယ်။
//   (user: "လိုရာ မရောက်ဘူး")。 ၀.၅၅ ဆိုရင် ၉/၀.၅၅ ≈ ၁၆.၄ — MAX_SPEED နဲ့
//   ကိုက်တယ်၊ လက်လွှတ်ရင်လည်း ~၂ စက္ကန့်နဲ့ ရပ်တယ်။
const DRAG = 0.55;
const TURN = 1.9;            // rad/s — အမြန်နှုန်း မြင့်လေ ကွေ့နိုင်လေ နည်း

export class Vehicle {
  /**
   * @param o.mesh   — ကားရဲ့ Object3D (မြေပေါ်မှာ ရှိပြီးသား)
   * @param o.box    — အဲဒီကားရဲ့ collider Box3 (မောင်းချိန် ဖြုတ်ဖို့)
   * @param o.label  — HUD မှာ ပြမယ့် နာမည်
   */
  constructor({ mesh, box, label = '🛻 ကား', doors = [] }) {
    this.mesh = mesh;
    this.box = box;
    this.label = label;
    this.speed = 0;
    this.driver = null;         // စီးနေသူ ရှိရင် avatar
    this.doors = doors;         // 🚪 ပတ္တာ တပ်ထားတဲ့ တံခါး ၂ ချပ်
    this.doorHold = 0;          // ပွင့်ထားမယ့် ကျန်ချိန် (စက္ကန့်)
  }

  /// ကားရဲ့ လက်ရှိ တည်နေရာ
  get position() { return this.mesh.position; }
}

/**
 * ကား အားလုံးကို စီမံတယ် — အနီးဆုံး ကားရှာ, ဝင်စီး, မောင်း, ဆင်း。
 * `engine.register()` ထဲ ထည့်ရမယ်။
 */
export class VehicleSystem {
  constructor({ engine, input, avatar, hud, sfx }) {
    this.engine = engine;
    this.input = input;
    this.avatar = avatar;
    this.hud = hud;
    this.sfx = sfx;
    this.room = null;           // လက်ရှိ အခန်း — ကားစာရင်းကို ဒီကနေ ဖတ်
    this.active = null;         // မောင်းနေတဲ့ ကား
    this._camTarget = new THREE.Vector3();
    this._engineNode = null;
  }

  /// အခန်း ကူးတိုင်း WorldManager က ခေါ်တယ်။
  /// ★ `room.cars` ကို **reference** အနေနဲ့ ကိုင်တယ် — ကားတွေက GLB
  ///   ရောက်မှ ထည့်တာမို့ ဒီအချိန်မှာ ဗလာ ဖြစ်နေတတ်တယ်၊ ကူးယူလိုက်ရင်
  ///   နောက်ကျ ရောက်လာတဲ့ ကားတွေ ဘယ်တော့မှ မပါတော့ဘူး။
  setRoom(room) {
    if (this.active) this.exit();
    this.room = room;
  }

  /// ကစားသမားနဲ့ အနီးဆုံး ကား (မောင်းလို့ရတဲ့ အကွာအဝေးထဲ)
  nearest(maxDist = 4.5) {
    if (this.active) return null;
    const cars = this.room?.cars;
    if (!cars || !cars.length) return null;
    const p = this.avatar.group.position;
    let best = null, bestD = maxDist;
    for (const v of cars) {
      const d = v.mesh.position.distanceTo(p);
      if (d < bestD) { best = v; bestD = d; }
    }
    return best;
  }

  /// 🚪 ကားတံခါး ဖွင့်/ပိတ် — ဝင်စီး/ဆင်းချိန်မှာ ဖွင့်ပြီး ပြန်ပိတ်တယ်
  swingDoors(v, seconds = 1.1) {
    if (!v?.doors?.length) return;
    for (const d of v.doors) d.target = 0;      // ၀ = ပွင့် (မော်ဒယ်ရဲ့ မူလ)
    v.doorHold = seconds;
    this.sfx?.ui({ up: true });
  }

  enter(v) {
    if (!v || this.active) return;
    this.active = v;
    v.speed = 0;
    this.swingDoors(v);
    // ကိုယ့်ကားနဲ့ ကိုယ် မတိုက်အောင် collider ဖြုတ်
    if (v.box) {
      const list = this.avatar.physics.colliders;
      const i = list.indexOf(v.box);
      if (i >= 0) list.splice(i, 1);
    }
    this.avatar.group.visible = false;
    // ★ avatar ရဲ့ ကိုယ်ပိုင် update ကို ရပ် — ကင်မရာ ရော လှုပ်ရှားမှု ရော
    //   နှစ်ခု ပြိုင်တူ ရေးနေရင် တုန်တယ် (Avatar.js မှာ ရှင်းပြထားတယ်)。
    this.avatar.driving = true;
    this.hud?.addToast(`${v.label} — မောင်းရန် joystick, ဆင်းရန် E`);
    this.sfx?.ui({ up: true });
    this._startEngineSound();
  }

  exit() {
    const v = this.active;
    if (!v) return;
    this.active = null;
    this._stopEngineSound();
    this.swingDoors(v);
    // ကားရဲ့ ဘေးမှာ ချ — ကားထဲမှာ မကျန်စေရ
    const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0), v.mesh.rotation.y);
    const p = v.mesh.position.clone().addScaledVector(side, 3.2);
    this.avatar.group.position.set(p.x, 0, p.z);
    this.avatar.group.visible = true;
    this.avatar.driving = false;
    // ★ ဆင်းတဲ့နေရာက နံရံထဲ ဖြစ်နေရင် ဖယ်ထုတ် — မဟုတ်ရင် အဆောက်အအုံထဲ
    //   ညပ်နေတယ် (ကားက အဆောက်အအုံနဲ့ ကပ်ရပ်ထားရင် ဖြစ်တတ်တယ်)。
    this.avatar.physics.resolveHorizontal(this.avatar.group.position, 0.4, 1.8);
    this.avatar.physics.resolveHorizontal(this.avatar.group.position, 0.4, 1.8);
    // collider ပြန်ထည့် — ကားရဲ့ အခု တည်နေရာနဲ့
    if (v.box) {
      v.box.setFromObject(v.mesh);
      v.box.min.y = 0;
      this.avatar.physics.colliders.push(v.box);
    }
    this.hud?.addToast('🚶 ကားပေါ်က ဆင်းပြီ');
    this.sfx?.ui({ up: false });
  }

  /// E နှိပ်တဲ့အခါ — စီးနေရင် ဆင်း, အနီးမှာ ကားရှိရင် စီး。 လုပ်ခဲ့ရင် true
  toggle() {
    if (this.active) { this.exit(); return true; }
    const v = this.nearest();
    if (v) { this.enter(v); return true; }
    return false;
  }

  /// 🚪 တံခါး လှုပ်ရှားမှု — ကား **အားလုံး**အတွက် (ဆင်းပြီးတဲ့ ကားရဲ့
  /// တံခါးလည်း ပြန်ပိတ်ရမယ်၊ အဲဒီအချိန်မှာ active မဟုတ်တော့ဘူး)
  _updateDoors(dt) {
    const cars = this.room?.cars;
    if (!cars) return;
    for (const v of cars) {
      if (!v.doors?.length) continue;
      if (v.doorHold > 0) {
        v.doorHold -= dt;
        if (v.doorHold <= 0) for (const d of v.doors) d.target = d.closed;
      }
      for (const d of v.doors) {
        if (Math.abs(d.angle - d.target) < 0.004) continue;
        const s = 3.4 * dt;
        d.angle += Math.max(-s, Math.min(s, d.target - d.angle));
        d.pivot.rotation.y = d.angle;
      }
    }
  }

  update(dt) {
    this._updateDoors(dt);
    const v = this.active;
    if (!v) return;

    // ── မောင်းခြင်း ────────────────────────────────────────────────
    // ★ Avatar နဲ့ **တစ်ထပ်တည်း** ဖတ်တယ် — WASD ရော touch joystick ရော
    //   (`input.touch.f/.s`)。 ကား အတွက် သီးသန့် input စနစ် မလိုဘူး၊
    //   joystick ကို ရှေ့တွန်း/ကွေ့ အဖြစ် တိုက်ရိုက် ယူတယ်။
    const inp = this.input;
    let fwd = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    let turn = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    if (inp.touch) { fwd += inp.touch.f; turn += inp.touch.s; }
    fwd = Math.max(-1, Math.min(1, fwd));
    turn = Math.max(-1, Math.min(1, turn));

    if (fwd > 0.05) v.speed += ACCEL * fwd * dt;
    else if (fwd < -0.05) v.speed += (v.speed > 0 ? -BRAKE : ACCEL * 0.6) * -fwd * dt * (v.speed > 0 ? 1 : -1);
    // ဆွဲငင် — လက်လွှတ်ရင် ဖြည်းဖြည်း ရပ်
    v.speed -= v.speed * DRAG * dt;
    v.speed = Math.max(-MAX_SPEED * 0.4, Math.min(MAX_SPEED, v.speed));

    // ရပ်နေရင် ကွေ့လို့ မရဘူး (တကယ့်ကားလိုပဲ)
    const grip = Math.min(1, Math.abs(v.speed) / 4);
    if (Math.abs(turn) > 0.05) {
      v.mesh.rotation.y -= turn * TURN * grip * dt * Math.sign(v.speed || 1);
    }

    // ရှေ့သို့ ရွေ့ — မော်ဒယ်ရဲ့ ရှေ့က +Z
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0), v.mesh.rotation.y);

    // ── အဆောက်အအုံ တိုက်မိရင် **ဘေးလျှော သွား** (ပြန်မကန်ဘူး) ─────────
    //
    // user: "လိုရာ မရောက်ဘူး၊ လယ်နေတယ်"
    //
    // ★ အရင်က တိုက်မိတိုင်း `v.speed *= -0.15` — ရှေ့မှာ ဘာများများ
    //   ရှိတိုင်း ကားက ပြန်ကန်ထွက်တယ်။ NPC, ထန်းပင်, နံရံ collider တွေ
    //   အများကြီး ထည့်ပြီးကတည်းက ဒါက ကားကို လုံးဝ မမောင်းနိုင်အောင်
    //   လုပ်ပစ်တယ် — ရှေ့တိုး/နောက်ကန် အလှည့်ကျ ဖြစ်ပြီး "လယ်နေတယ်"。
    // ★ အခု တကယ့်ကားလိုပဲ: ရှေ့တည့်တည့် မရရင် **X ချည်း / Z ချည်း**
    //   စမ်းတယ် — နံရံနဲ့ စောင်းတိုက်ရင် ဘေးလျှောပြီး ဆက်သွားလို့ရတယ်။
    //   နှစ်ခုစလုံး မရမှ ရပ်တယ် (ပြန်မကန်ဘူး, အရှိန်ကိုပဲ ဖြတ်တယ်)。
    // ★ **အလျားလိုက်ပဲ** နှိုင်းရမယ် — probe ကို y=၀.၆ တင်ထားပြီး
    //   `distanceTo(next)` (next.y ≈ ၀.၀၃) နဲ့ နှိုင်းရင် အမြဲ ၀.၅၇
    //   ကျော်နေလို့ တိုက်မိတယ်လို့ အမြဲ ထင်တယ်။
    const step = v.speed * dt;
    const free = (nx, nz) => {
      const probe = new THREE.Vector3(nx, 0.6, nz);
      this.avatar.physics.resolveHorizontal(probe, 1.5, 1.2);
      return Math.hypot(probe.x - nx, probe.z - nz) < 0.05;
    };
    const px = v.mesh.position.x, pz = v.mesh.position.z;
    const tx = px + dir.x * step, tz = pz + dir.z * step;
    if (free(tx, tz)) {
      v.mesh.position.set(tx, v.mesh.position.y, tz);
    } else if (free(tx, pz)) {
      v.mesh.position.x = tx;                 // ဘေးလျှော — X ဘက် ဆက်သွား
      v.speed *= 0.86;
    } else if (free(px, tz)) {
      v.mesh.position.z = tz;                 // ဘေးလျှော — Z ဘက် ဆက်သွား
      v.speed *= 0.86;
    } else {
      v.speed *= 0.2;                         // တကယ် ပိတ်နေပြီ — ရပ်
      if (Math.abs(step) > 0.08) this.sfx?.hit({ vol: 0.35 });
    }

    // ── ကင်မရာ — ကားနောက်က လိုက် ──────────────────────────────────
    const cam = this.engine.camera;
    const back = dir.clone().multiplyScalar(-9);
    this._camTarget.set(
      v.mesh.position.x + back.x, v.mesh.position.y + 4.6, v.mesh.position.z + back.z);
    cam.position.lerp(this._camTarget, Math.min(1, dt * 4));
    cam.lookAt(v.mesh.position.x, v.mesh.position.y + 1.2, v.mesh.position.z);

    // ကစားသမား တည်နေရာကို ကားနဲ့ တွဲထား — ဆင်းချိန် မှန်အောင်၊
    // multiplayer မှာလည်း တခြားသူတွေက ကားနဲ့အတူ မြင်ရအောင်
    this.avatar.group.position.set(v.mesh.position.x, 0, v.mesh.position.z);

    this._engineTone(Math.abs(v.speed) / MAX_SPEED);
  }

  // ── 🔊 engine သံ — oscillator တစ်ခု, speed အလိုက် အသံအမြင့် ────────
  _startEngineSound() {
    const ctx = this.sfx?._ensure?.();
    if (!ctx || !this.sfx.enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    gain.gain.value = 0.06;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 480;
    osc.connect(lp).connect(gain).connect(this.sfx.master);
    osc.start();
    this._engineNode = { osc, gain, ctx };
  }
  _engineTone(t) {
    const n = this._engineNode;
    if (!n) return;
    n.osc.frequency.setTargetAtTime(58 + t * 150, n.ctx.currentTime, 0.08);
    n.gain.gain.setTargetAtTime(0.05 + t * 0.09, n.ctx.currentTime, 0.1);
  }
  _stopEngineSound() {
    const n = this._engineNode;
    if (!n) return;
    try { n.osc.stop(n.ctx.currentTime + 0.05); } catch { /* already stopped */ }
    this._engineNode = null;
  }
}
