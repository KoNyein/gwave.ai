// avatar/Motions.js — အသေးစိတ် procedural motion system
// State machine + crossfade blending · bone-name driven → mannequin ရော scan GLB ရော အလုပ်လုပ်
// States: IDLE, WALK, RUN, CROUCH, CROUCH_WALK, JUMP, PILOT_SIT, WAVE
// Layers: locomotion (full body) + AIM (upper-body override) + HEAD_LOOK (procedural)
import * as THREE from 'three';

const lerp = THREE.MathUtils.lerp;

export class Motions {
  constructor(avatar) {
    this.av = avatar;
    this.state = 'IDLE';
    this.prevState = 'IDLE';
    this.blend = 1;                  // 0→1 crossfade
    this.blendTime = 0.18;           // s
    this.t = 0;                      // global clock
    this.phase = 0;                  // gait phase (radians)
    this.speed = 0;                  // m/s (for gait freq)
    this.aim = 0;                    // 0..1 upper-body aim layer weight
    this.lookTarget = null;          // THREE.Vector3 | null (head look-at)
    this.jumpT = -1;                 // jump timeline
    this._pose = {};                 // key → [x,y,z] current blended euler
    this._poseA = {}; this._poseB = {};
    this.hipsBaseY = avatar.bones.hips?.position.y ?? 0.95;
  }

  set(state) {
    if (state === this.state) return;
    this.prevState = this.state;
    this.state = state;
    this.blend = 0;
    if (state === 'JUMP') this.jumpT = 0;
  }

  update(dt, moveSpeed = 0) {
    this.t += dt;
    this.speed = moveSpeed;
    this.blend = Math.min(1, this.blend + dt / this.blendTime);

    // gait phase — ခြေလှမ်းနှုန်း speed နဲ့လိုက် (walk 2Hz @1.5m/s, run 3Hz @6m/s)
    const freq = this.state === 'RUN' ? 2.6 + this.speed * 0.12
               : this.state.startsWith('CROUCH') ? 1.6
               : 1.9 + this.speed * 0.2;
    if (['WALK', 'RUN', 'CROUCH_WALK'].includes(this.state)) this.phase += dt * freq * Math.PI * 2;

    // blend prev→current pose
    this._evalState(this.prevState, this._poseA);
    this._evalState(this.state, this._poseB);
    const keys = new Set([...Object.keys(this._poseA), ...Object.keys(this._poseB)]);
    for (const k of keys) {
      const a = this._poseA[k] ?? [0, 0, 0], b = this._poseB[k] ?? [0, 0, 0];
      this._pose[k] = [lerp(a[0], b[0], this.blend), lerp(a[1], b[1], this.blend), lerp(a[2], b[2], this.blend)];
    }

    this._layerAim(dt);
    this._layerHeadLook();
    this._layerBreathing();

    // apply to skeleton
    for (const [k, e] of Object.entries(this._pose)) this.av.setBone(k, e[0], e[1], e[2]);
    // hips vertical (bob / crouch / sit / jump)
    const hips = this.av.bones.hips;
    if (hips) hips.position.y = this.hipsBaseY + (this._hipsOffset ?? 0);

    if (this.jumpT >= 0) { this.jumpT += dt; if (this.jumpT > 0.75) { this.jumpT = -1; this.set('IDLE'); } }
  }

  // ================= STATE POSES =================
  _evalState(state, out) {
    for (const k in out) delete out[k];
    const p = (k, x, y, z) => out[k] = [x, y, z];
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    this._hipsOffset = 0;

    switch (state) {
      // ---------- IDLE: breathing + weight shift + micro glance ----------
      case 'IDLE': {
        const sway = Math.sin(this.t * 0.7) * 0.02;          // ကိုယ်အလေးချိန်ရွှေ့
        const glance = Math.sin(this.t * 0.23) * 0.12;       // ခေါင်းအနည်းငယ်ကြည့်
        p('hips', 0, 0, sway);
        p('spine1', 0.02, 0, -sway * 0.6);
        p('head', 0, glance, 0);
        p('armL', 0, 0, 0.04 + sway); p('armR', 0, 0, -0.04 + sway);
        p('upLegL', 0, 0, -sway * 0.5); p('upLegR', 0, 0, -sway * 0.5);
        break;
      }
      // ---------- WALK: leg swing, knee flex, foot roll, arm counter-swing, hip sway ----------
      case 'WALK': {
        const amp = Math.min(1, this.speed / 2.5) * 0.55;    // leg swing ±~31°
        p('upLegL',  s * amp, 0,  c * 0.03);                 // ပေါင်လွှဲ + hip sway
        p('upLegR', -s * amp, 0,  c * 0.03);
        p('legL', Math.max(0, -c) * amp * 1.15, 0, 0);       // ဒူးကွေး (swing phase သာ)
        p('legR', Math.max(0,  c) * amp * 1.15, 0, 0);
        p('footL', -s * amp * 0.5 - 0.05, 0, 0);             // ခြေဖဝါး heel-toe roll
        p('footR',  s * amp * 0.5 - 0.05, 0, 0);
        p('armL', -s * amp * 0.75, 0, 0.06);                 // လက် counter-swing
        p('armR',  s * amp * 0.75, 0, -0.06);
        p('foreL', Math.max(0,  s) * 0.3, 0, 0);
        p('foreR', Math.max(0, -s) * 0.3, 0, 0);
        p('hips', 0, s * 0.06, c * 0.05);                    // hip rotation + sway
        p('spine1', 0.04, -s * 0.05, -c * 0.03);             // counter-rotate ရင်ဘတ်
        p('head', 0, s * 0.03, 0);
        this._hipsOffset = Math.abs(Math.sin(this.phase)) * -0.025; // gait bob
        break;
      }
      // ---------- RUN: forward lean, big amplitude, air time bounce ----------
      case 'RUN': {
        const amp = 0.85;
        p('upLegL',  s * amp, 0, 0); p('upLegR', -s * amp, 0, 0);
        p('legL', Math.max(0.12, -c) * 1.5, 0, 0);
        p('legR', Math.max(0.12,  c) * 1.5, 0, 0);
        p('footL', -s * 0.45, 0, 0); p('footR', s * 0.45, 0, 0);
        p('armL', -s * 1.0, 0, 0.12); p('armR', s * 1.0, 0, -0.12);
        p('foreL', 1.15, 0, 0); p('foreR', 1.15, 0, 0);      // တံတောင်ကွေးထား
        p('hips', 0.10, s * 0.10, c * 0.06);
        p('spine1', 0.22, -s * 0.09, 0);                     // အရှေ့ကိုင်း 12°+
        p('head', -0.12, 0, 0);
        this._hipsOffset = Math.abs(s) * -0.05 + 0.02;
        break;
      }
      // ---------- CROUCH / CROUCH_WALK ----------
      case 'CROUCH':
      case 'CROUCH_WALK': {
        const walk = state === 'CROUCH_WALK' ? Math.min(1, this.speed / 1.5) * 0.35 : 0;
        p('upLegL', -1.15 + s * walk, 0, 0.06);
        p('upLegR', -1.15 - s * walk, 0, -0.06);
        p('legL', 1.55 + Math.max(0, -c) * walk, 0, 0);
        p('legR', 1.55 + Math.max(0,  c) * walk, 0, 0);
        p('footL', -0.35, 0, 0); p('footR', -0.35, 0, 0);
        p('hips', 0.28, walk ? s * 0.05 : 0, 0);
        p('spine1', 0.25, 0, 0);
        p('head', -0.28, 0, 0);                              // မျက်လုံးရှေ့ကြည့်နေအောင်
        p('armL', -0.35 - s * walk * 0.5, 0, 0.1);
        p('armR', -0.35 + s * walk * 0.5, 0, -0.1);
        this._hipsOffset = -0.42;
        break;
      }
      // ---------- JUMP: anticipation → extend → land ----------
      case 'JUMP': {
        const jt = Math.max(0, this.jumpT);
        let squat, air;
        if (jt < 0.12) { squat = jt / 0.12; air = 0; }                 // ဆောင့်ကြောင့်
        else if (jt < 0.5) { squat = 1 - (jt - 0.12) / 0.1; air = Math.min(1, (jt - 0.12) / 0.12); squat = Math.max(0, squat); }
        else { squat = (jt - 0.5) / 0.25 * 0.6; air = 1 - (jt - 0.5) / 0.25; air = Math.max(0, air); } // landing absorb
        p('upLegL', -squat * 0.9 - air * 0.5, 0, 0);
        p('upLegR', -squat * 0.9 - air * 0.3, 0, 0);
        p('legL', squat * 1.4 + air * 0.9, 0, 0);
        p('legR', squat * 1.4 + air * 0.5, 0, 0);
        p('armL', -squat * 0.5 + air * 1.6, 0, 0.35);        // လက်မြှောက်
        p('armR', -squat * 0.5 + air * 1.6, 0, -0.35);
        p('spine1', squat * 0.25 - air * 0.08, 0, 0);
        this._hipsOffset = -squat * 0.28 + air * 0.1;
        break;
      }
      // ---------- PILOT_SIT: ထိုင်ပြီး radio ကိုင် + goggles ငုံ့ကြည့် ----------
      case 'PILOT_SIT': {
        const micro = Math.sin(this.t * 5) * 0.02;           // stick လှုပ်နေသလို လက်မ micro
        p('upLegL', -1.5, 0.15, 0.12); p('upLegR', -1.5, -0.15, -0.12);
        p('legL', 1.65, 0, 0); p('legR', 1.65, 0, 0);
        p('footL', -0.2, 0, 0); p('footR', -0.2, 0, 0);
        p('spine1', 0.18, 0, 0);
        p('head', 0.35, Math.sin(this.t * 0.4) * 0.06, 0);   // goggles ငုံ့ + အနည်းငယ်ယမ်း
        p('armL', -0.9 + micro, 0.25, 0.55);                 // radio ကိုင်ပုံ
        p('armR', -0.9 - micro, -0.25, -0.55);
        p('foreL', 1.35, 0.3, 0); p('foreR', 1.35, -0.3, 0);
        p('handL', 0, 0, micro * 4); p('handR', 0, 0, -micro * 4); // gimbal thumbs
        this._hipsOffset = -0.50;
        break;
      }
      // ---------- WAVE emote ----------
      case 'WAVE': {
        const w = Math.sin(this.t * 6);
        p('armR', 0, 0, -2.4);                               // လက်မြှောက်
        p('foreR', 0.3, 0, -0.5 + w * 0.35);                 // လက်ဝှေ့
        p('head', 0, 0.15, 0.08);
        p('spine1', 0, 0.08, 0);
        p('armL', 0, 0, 0.06);
        break;
      }
    }
  }

  // ---------- AIM layer (upper body override — walk ရင်း ချိန်နိုင်) ----------
  setAim(weight) { this.aim = THREE.MathUtils.clamp(weight, 0, 1); }
  _layerAim(dt) {
    if (this.aim <= 0.001) return;
    const a = this.aim;
    const mix = (k, x, y, z) => {
      const cur = this._pose[k] ?? [0, 0, 0];
      this._pose[k] = [lerp(cur[0], x, a), lerp(cur[1], y, a), lerp(cur[2], z, a)];
    };
    mix('armR', -1.35, -0.15, -0.25);      // သေနတ်ချိန်ပုံ — ညာလက်ဆန့်
    mix('foreR', 0.25, 0, 0);
    mix('armL', -1.15, 0.45, 0.35);        // ဘယ်လက် foregrip
    mix('foreL', 0.85, 0.35, 0);
    mix('spine1', 0.06, -0.28, 0);         // ရင်ဘတ်စောင်း (shoulder to target)
    mix('head', 0.02, -0.22, 0);           // sight ထဲကြည့်
  }

  // ---------- HEAD LOOK layer (procedural look-at, clamp ±70°) ----------
  setLookTarget(v3 /* world pos | null */) { this.lookTarget = v3; }
  _layerHeadLook() {
    if (!this.lookTarget || !this.av.bones.head) return;
    const headWorld = new THREE.Vector3();
    this.av.bones.head.getWorldPosition(headWorld);
    const dir = this.lookTarget.clone().sub(headWorld);
    const rootYaw = this.av.root.rotation.y;
    const yaw = THREE.MathUtils.clamp(
      Math.atan2(dir.x, dir.z) - rootYaw - Math.PI, -1.2, 1.2);
    const pitch = THREE.MathUtils.clamp(
      -Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.9, 0.9);
    const cur = this._pose.head ?? [0, 0, 0];
    // ခေါင်း 70% + ရင်ဘတ် 30% ခွဲလှည့် (သဘာဝကျအောင်)
    this._pose.head = [lerp(cur[0], pitch, 0.7), lerp(cur[1], -yaw, 0.7), cur[2]];
    const sp = this._pose.spine2 ?? [0, 0, 0];
    this._pose.spine2 = [sp[0], lerp(sp[1], -yaw * 0.3, 0.5), sp[2]];
  }

  // ---------- BREATHING layer (always on) ----------
  _layerBreathing() {
    const br = Math.sin(this.t * 2.1) * (this.state === 'RUN' ? 0.035 : 0.012);
    const sp = this._pose.spine2 ?? [0, 0, 0];
    this._pose.spine2 = [sp[0] + br, sp[1], sp[2]];
    const nk = this._pose.neck ?? [0, 0, 0];
    this._pose.neck = [nk[0] - br * 0.5, nk[1], nk[2]];
  }
}
