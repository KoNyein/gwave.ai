// ============================================================
// Locomotion.js — Avatar ရဲ့ **ခြေလှမ်း / ရပ် / ထိုင်** လှုပ်ရှားမှု
//
// user: "Avatar တွေက ထိုင်တာ ထတာ ခြေလှမ်းတာတွေ မလုပ်ဘူး"
//
// အရင်က Avatar.setModel() က GLB ရဲ့ **clip[0] တစ်ခုတည်းကို ထာဝရ ဖွင့်**
// ထားတယ် — ရွေ့နေလား ရပ်နေလား လုံးဝ မကြည့်ဘူး။ ဒါကြောင့်:
//   · Soldier.glb  → clip[0] = "Idle" ⇒ ရွေ့နေတုန်း ငြိမ်ငြိမ် လျှောသွားတယ်
//     (Walk နဲ့ Run clip တွေ ရှိပါလျက် တစ်ခါမှ မသုံးဘူး)
//   · Xbot.glb     → clip[0] = "agree" ⇒ ခေါင်းညိတ်နေတာ ထာဝရ
//   · Michelle.glb → clip[0] = "SambaDance" ⇒ ကနေတာ ထာဝရ
//   · Character3/4/5.glb → clip **တစ်ခုမှ မရှိ** ⇒ ကျောက်ရုပ် အတိုင်း
//
// ဒီ class က နှစ်နည်း ရှိတယ်:
//   ① Clip mode — GLB ထဲမှာ idle/walk/run ရှိရင် အမြန်နှုန်းအလိုက်
//      cross-fade လုပ်တယ် (Soldier, Xbot)。
//   ② Procedural mode — clip မရှိ/မလုံလောက်ရင် **အရိုးတွေကို ကိုယ်တိုင်
//      လှုပ်တယ်** (mixamorig ခြေ/လက်)。 ဒါမှ Character3/4/5 လိုဟာတွေရော
//      "mixamo.com" clip တစ်ခုတည်းပါတဲ့ ဖိုင်တွေရော ခြေလှမ်းတယ်။
//
// ★ ထိုင်တာက mode နှစ်မျိုးလုံးမှာ procedural — sit clip မပါတဲ့ GLB က
//   အများစုမို့။
// ============================================================
import * as THREE from 'three';

/// အရိုးနာမည် ရှာဖွေချက် — Mixamo က `mixamorig:LeftUpLeg`၊ exporter တချို့က
/// colon ဖြုတ်ပစ်တယ် (`mixamorigLeftUpLeg`)၊ Blender က `.001` ဆက်တတ်တယ်။
/// ဒါကြောင့် သတ်သတ်မှတ်မှတ် မယှဉ်ဘဲ ပါဝင်မှုနဲ့ ရှာတယ်။
const BONES = {
  hips:     [/hips$/i],
  spine:    [/spine$/i, /spine1$/i],
  lUpLeg:   [/left.?up.?leg/i, /l.?thigh/i, /upleg\.l/i],
  rUpLeg:   [/right.?up.?leg/i, /r.?thigh/i, /upleg\.r/i],
  lLeg:     [/left.?leg$/i, /l.?shin/i, /leg\.l/i],
  rLeg:     [/right.?leg$/i, /r.?shin/i, /leg\.r/i],
  lArm:     [/left.?arm$/i, /l.?upperarm/i],
  rArm:     [/right.?arm$/i, /r.?upperarm/i],
  lForeArm: [/left.?fore.?arm/i, /l.?lowerarm/i],
  rForeArm: [/right.?fore.?arm/i, /r.?lowerarm/i],
};

function findBones(root) {
  const out = {};
  root.traverse((o) => {
    if (!o.isBone) return;
    for (const [key, pats] of Object.entries(BONES)) {
      if (out[key]) continue;
      if (pats.some((p) => p.test(o.name))) out[key] = o;
    }
  });
  return out;
}

/// Clip ကို နာမည်နဲ့ ရှာ — "Idle" / "idle" / "Armature|idle" အားလုံး ကိုက်
const pickClip = (clips, pats) =>
  clips.find((c) => pats.some((p) => p.test(c.name))) || null;

export class Locomotion {
  /**
   * @param {THREE.Object3D} model  GLB ရဲ့ scene
   * @param {THREE.AnimationClip[]} clips
   */
  constructor(model, clips = []) {
    this.model = model;
    this.bones = findBones(model);
    this.phase = 0;
    this.blend = 0;      // 0 = ရပ်, 1 = အပြည့်လှမ်း (ချောချောကူး)
    this.sitAmt = 0;     // 0 = မတ်တပ်, 1 = ထိုင်
    this.state = { speed: 0, running: false, grounded: true, sitting: false };

    const idle = pickClip(clips, [/^idle/i, /stand/i, /breath/i]);
    const walk = pickClip(clips, [/^walk/i, /^walking/i]);
    const run  = pickClip(clips, [/^run/i, /^jog/i, /^sprint/i]);

    // ① Clip mode — idle + walk အနည်းဆုံး ရှိမှ (run မရှိရင် walk ကို မြှင့်သုံး)
    if (idle && walk) {
      this.mixer = new THREE.AnimationMixer(model);
      this.actions = {
        idle: this.mixer.clipAction(idle),
        walk: this.mixer.clipAction(walk),
        run: run ? this.mixer.clipAction(run) : null,
      };
      for (const a of Object.values(this.actions)) {
        if (!a) continue;
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.enabled = true;
        a.setEffectiveWeight(0);
        a.play();
      }
      this.actions.idle.setEffectiveWeight(1);
      this.mode = 'clip';
    } else {
      // ② Procedural — အရိုးတွေကို ကိုယ်တိုင် လှုပ်မယ်
      this.mode = this.bones.lUpLeg && this.bones.rUpLeg ? 'bones' : 'none';
      // အနားယူ pose ကို မှတ်ထား — offset ပုံစံ တွက်ဖို့ (တစ်ခါတည်း စုမသွားစေရ)
      this.rest = {};
      for (const [k, b] of Object.entries(this.bones)) {
        this.rest[k] = b.quaternion.clone();
      }
      this.restHipY = this.bones.hips ? this.bones.hips.position.y : 0;
      // ★ clip တစ်ခုတည်းပါတဲ့ GLB (SambaDance / agree / mixamo.com) ကို
      //   **မဖွင့်ဘူး** — ရွေ့နေတာနဲ့ မဆိုင်တဲ့ လှုပ်ရှားမှုက ခြေလှမ်းကို
      //   ဖျက်ပစ်တယ်။ လိုအပ်ရင် emote အဖြစ် သီးသန့် ဖွင့်လို့ရတယ်။
      this._spare = clips.length ? clips[0] : null;
    }
  }

  /** Avatar ရဲ့ update() ကနေ frame တိုင်း ခေါ် */
  setMotion({ speed = 0, running = false, grounded = true, sitting = false }) {
    this.state.speed = speed;
    this.state.running = running;
    this.state.grounded = grounded;
    this.state.sitting = sitting;
  }

  update(dt) {
    const st = this.state;
    // ထိုင်/ထ — ချောချော ကူးတယ် (ရုတ်တရက် ခုန်မသွားစေရ)
    const sitTarget = st.sitting ? 1 : 0;
    this.sitAmt += (sitTarget - this.sitAmt) * Math.min(1, dt * 8);

    const moving = !st.sitting && st.grounded && st.speed > 0.15;
    const target = moving ? 1 : 0;
    this.blend += (target - this.blend) * Math.min(1, dt * 10);

    if (this.mode === 'clip') this._updateClips(dt);
    else if (this.mode === 'bones') this._updateBones(dt);
  }

  _updateClips(dt) {
    const st = this.state, a = this.actions;
    this.mixer.update(dt);
    // ရပ် ⇄ လှမ်း ⇄ ပြေး — အလေးချိန်နဲ့ ရောတယ် (ခြေထောက် မခုန်စေရ)
    const runW = a.run && st.running ? this.blend : 0;
    const walkW = this.blend - runW;
    a.idle.setEffectiveWeight(1 - this.blend);
    a.walk.setEffectiveWeight(walkW);
    if (a.run) a.run.setEffectiveWeight(runW);
    // ပြေးရင် walk clip ကို ပိုမြန်စေတယ် (run clip မရှိတဲ့ GLB အတွက်)
    a.walk.setEffectiveTimeScale(!a.run && st.running ? 1.6 : 1);
    // ★ ထိုင်ချိန် clip အားလုံး ရပ် — pose ကို အောက်က bone code က ချတယ်
    if (this.sitAmt > 0.5) {
      a.idle.setEffectiveWeight(0);
      a.walk.setEffectiveWeight(0);
      if (a.run) a.run.setEffectiveWeight(0);
    }
    if (this.sitAmt > 0.01) this._applySit();
  }

  _updateBones(dt) {
    const st = this.state, b = this.bones;
    // ခြေလှမ်း အမြန်နှုန်း — တကယ်ရွေ့နေတဲ့ အမြန်နှုန်းနဲ့ ချိတ်တယ်၊
    // ဒါမှ ဖြည်းဖြည်းသွားရင် ဖြည်းဖြည်း လှမ်းတယ် (ရေပေါ်လျှောသလို မဖြစ်)。
    this.phase += dt * (2.2 + st.speed * 0.9) * (this.blend > 0.02 ? 1 : 0);

    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const set = (key, x = 0, y = 0, z = 0) => {
      const bone = b[key];
      if (!bone) return;
      e.set(x, y, z);
      q.setFromEuler(e);
      bone.quaternion.copy(this.rest[key]).multiply(q);
    };

    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = 0.62 * this.blend * (st.running ? 1.25 : 1);
    const armAmp = 0.45 * this.blend * (st.running ? 1.3 : 1);

    // ခြေထောက် — ဘယ်နဲ့ညာ ဆန့်ကျင်ဘက်
    set('lUpLeg', s * amp);
    set('rUpLeg', -s * amp);
    // ဒူး — ရှေ့ဆွဲချိန်မှာသာ ကွေးတယ် (နောက်ပြန် မကွေးရ)
    set('lLeg', Math.max(0, -c) * amp * 1.15);
    set('rLeg', Math.max(0, c) * amp * 1.15);
    // လက် — ခြေထောက်နဲ့ ဆန့်ကျင်ဘက် (လူ့သဘာဝ)
    set('lArm', -s * armAmp, 0, 0.14);
    set('rArm', s * armAmp, 0, -0.14);
    set('lForeArm', -Math.abs(s) * armAmp * 0.5);
    set('rForeArm', -Math.abs(s) * armAmp * 0.5);

    // ခန္ဓာကိုယ် အသက်ရှူ + လှမ်းချိန် အနည်းငယ် တက်ဆင်း
    if (b.hips) {
      const bob = Math.abs(Math.sin(this.phase * 2)) * 0.035 * this.blend;
      const breathe = Math.sin(performance.now() * 0.0016) * 0.006 * (1 - this.blend);
      b.hips.position.y = this.restHipY + bob + breathe;
    }
    if (this.sitAmt > 0.01) this._applySit();
  }

  /// 🪑 ထိုင် pose — clip mode ရော bones mode ရော တူညီတယ်
  /// (sit clip ပါတဲ့ GLB မရှိသလောက်ဖြစ်လို့ procedural ပဲ သုံးတယ်)
  _applySit() {
    const b = this.bones, k = this.sitAmt;
    if (!b.lUpLeg || !b.rUpLeg) return;
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const blendTo = (key, x) => {
      const bone = b[key];
      if (!bone) return;
      e.set(x * k, 0, 0);
      q.setFromEuler(e);
      // clip mode မှာ mixer က pose ချထားပြီးသား — အပေါ်က ထပ်ထည့်တယ်
      bone.quaternion.multiply(q);
    };
    blendTo('lUpLeg', -1.45);
    blendTo('rUpLeg', -1.45);
    blendTo('lLeg', 1.5);
    blendTo('rLeg', 1.5);
    blendTo('spine', 0.12);
    if (b.hips) b.hips.position.y = this.restHipY - 0.42 * k;
  }

  /** GLB ထဲက clip တစ်ခုကို emote အဖြစ် တစ်ခါ ဖွင့် (ရှိမှ) */
  playSpare() {
    if (!this._spare || this.mixer) return false;
    this.mixer = new THREE.AnimationMixer(this.model);
    const a = this.mixer.clipAction(this._spare);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.reset().play();
    return true;
  }
}
