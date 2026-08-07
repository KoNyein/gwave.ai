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
    // ★ mode နှစ်မျိုးလုံးမှာ လိုတယ် — ထိုင်ချိန် တင်ပါး နိမ့်ချဖို့။
    //   အရင်က bones mode မှာပဲ သတ်မှတ်လို့ clip mode (Soldier/Xbot) မှာ
    //   ထိုင်လိုက်ရင် undefined × ဂဏန်း = NaN ဖြစ်ပြီး ရုပ် ပျောက်သွားမယ်။
    this.restHipY = this.bones.hips ? this.bones.hips.position.y : 0;
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
      if (this.mode === 'bones') {
        // ★ အစီအစဉ် အရေးကြီးတယ် — လက်ကို အရင် ချ၊ ပြီးမှ ဝင်ရိုး တွက်။
        //   ဝင်ရိုးတွေက အရိုးရဲ့ world rotation ကနေ ထုတ်တာမို့။
        this._relaxArms();
        this._computeAxes();
        this._bendElbows();
      }
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

    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    // ★ လူ့ခြေလှမ်း အတိုင်းအတာ — တင်ပါး ~24°、ဒူး ~28°、လက် ~18°。
    //   အရင်က 0.62rad (35°) ထားလို့ ခြေထောက် ဆွဲကားထားသလို ဖြစ်တယ်။
    const amp = 0.42 * this.blend * (st.running ? 1.3 : 1);
    const armAmp = 0.32 * this.blend * (st.running ? 1.35 : 1);

    // ခြေထောက် — ဘယ်နဲ့ညာ ဆန့်ကျင်ဘက် (ရှေ့/နောက် ယိမ်း)
    this._swing('lUpLeg', s * amp);
    this._swing('rUpLeg', -s * amp);
    // ဒူး — ရှေ့ဆွဲချိန်မှာသာ ကွေးတယ် (နောက်ပြန် မကွေးရ)
    this._swing('lLeg', Math.max(0, -c) * amp * 1.2);
    this._swing('rLeg', Math.max(0, c) * amp * 1.2);
    // လက် — ခြေထောက်နဲ့ ဆန့်ကျင်ဘက် (လူ့သဘာဝ)
    this._swing('lArm', -s * armAmp);
    this._swing('rArm', s * armAmp);
    this._swing('lForeArm', -Math.abs(s) * armAmp * 0.45);
    this._swing('rForeArm', -Math.abs(s) * armAmp * 0.45);

    // ခန္ဓာကိုယ် အသက်ရှူ + လှမ်းချိန် အနည်းငယ် တက်ဆင်း
    if (b.hips) {
      const bob = Math.abs(Math.sin(this.phase * 2)) * 0.03 * this.blend;
      const breathe = Math.sin(performance.now() * 0.0016) * 0.005 * (1 - this.blend);
      b.hips.position.y = this.restHipY + bob + breathe;
    }
    if (this.sitAmt > 0.01) this._applySit();
  }

  /// ── အရိုးတစ်ချောင်းကို **ခန္ဓာကိုယ်ရဲ့ ဘယ်-ညာ ဝင်ရိုး**ပတ် ယိမ်းစေတယ် ──
  ///
  /// `rotation.x` တိုက်ရိုက် ပေးတာက **အရိုးရဲ့ ကိုယ်ပိုင် X ဝင်ရိုး** ပတ်
  /// လှည့်တာ — rig တစ်ခုနဲ့တစ်ခု မတူဘူး။ ဒီမှာတော့ ခန္ဓာကိုယ်ရဲ့ ညာဘက်
  /// ဝင်ရိုး (model space X) ကို အရိုးရဲ့ local frame ထဲ ပြောင်းပြီး
  /// အဲဒီဝင်ရိုးပတ်ပဲ လှည့်တယ်။
  ///
  /// ★ လက်ရှိ GLB ၁၀ ခုမှာ ခြေရိုးတွေက local-X ရော body-X ရော တူညီနေတယ်
  ///   (တိုင်းကြည့်ပြီး) — ဒါပေမယ့် အဲဒါက ကံကောင်းတာ။ scanner ကထွက်တဲ့
  ///   rig ဒါမှမဟုတ် Blender ကနေ တင်တဲ့ rig တွေမှာ မတူတော့ရင် ဒီနည်းက
  ///   ဆက်မှန်နေမယ်။
  _swing(key, angle) {
    const bone = this.bones[key];
    if (!bone) return;
    const axis = this.axes[key];
    if (!axis) return;
    this._q.setFromAxisAngle(axis, angle);
    bone.quaternion.copy(this.rest[key]).multiply(this._q);
  }

  /// ── 🙆 T-pose ကို **လက်ချ** အနေအထား ပြောင်း ────────────────────────
  ///
  /// user: "T-pose ဖြစ်နေတဲ့ avatar လက်တွေ လက်ချ လမ်းလျှောက်ဟန် ထားပါ"
  ///
  /// GLB **၁၀ ခုစလုံး** T-pose နဲ့ ထုတ်ထားတယ် (လက် ၉၀° ဘေးဖြန့်) —
  /// တိုင်းကြည့်ပြီး။ Clip ပါတဲ့ ဖိုင် (Soldier, Xbot) က clip ကနေ pose
  /// ချလို့ အဆင်ပြေတယ်၊ ဒါပေမယ့် procedural mode မှာ rest pose ကနေ
  /// ယိမ်းတာမို့ **လက်က ဘေးဖြန့်အတိုင်း** ကျန်နေတယ် — လူပုံစံ မဟုတ်တော့ဘူး။
  ///
  /// ဒီမှာ rest pose ကိုယ်တိုင်ကို ပြင်တယ်: လက်ကို အောက်ကို ချပြီး
  /// ဘေးကို ၈° လောက်ပဲ ကားထားတယ် (လူ ရပ်နေတဲ့ သဘာဝ)。 ပြီးမှ အဲဒီ
  /// အနေအထားကနေ ရှေ့/နောက် ယိမ်းတယ်။
  _relaxArms() {
    const model = this.model;
    if (!model) return;
    model.updateWorldMatrix(true, true);
    const modelQ = new THREE.Quaternion();
    model.getWorldQuaternion(modelQ);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(modelQ);
    const OUT = 0.14; // ~8° — လက်နဲ့ ခန္ဓာကိုယ် မကပ်အောင်

    const firstBoneChild = (b) => b.children.find((c) => c.isBone) || null;
    const a = new THREE.Vector3(), c = new THREE.Vector3();
    const qw = new THREE.Quaternion(), pw = new THREE.Quaternion();

    // ★ "ဘယ်" ဆိုတာ model space ရဲ့ ဘယ်ဘက်လဲ — rig အလိုက် မတူဘူး
    //   (Mixamo က +X၊ တချို့က −X)。 မှန်းလို့ မရဘူး — မှားရင် လက်က
    //   ခန္ဓာကိုယ်ကို ဖြတ်ပြီး ရှေ့မှာ ကပ်နေတယ်။ ဒါကြောင့် ခန္ဓာကိုယ်ရဲ့
    //   အလယ်တန်း (spine/hips) နဲ့ နှိုင်းပြီး **rig ကိုယ်တိုင်ဆီက** ယူတယ်။
    const mid = new THREE.Vector3();
    (this.bones.spine || this.bones.hips || model).getWorldPosition(mid);
    const sideOf = (bone) => {
      bone.getWorldPosition(a);
      // model space ထဲ ပြန်သွင်း — model လှည့်ထားရင်ပါ မှန်အောင်
      const rel = a.clone().sub(mid).applyQuaternion(modelQ.clone().invert());
      return rel.x >= 0 ? 1 : -1;
    };

    for (const key of ['lArm', 'rArm']) {
      const bone = this.bones[key];
      const child = bone && firstBoneChild(bone);
      if (!bone || !child) continue;
      const sign = sideOf(bone);
      bone.getWorldPosition(a);
      child.getWorldPosition(c);
      const dir = c.sub(a).normalize();
      // ရပ်နေပြီးသား (၄၀° အောက်) ဆိုရင် မထိဘူး — အလကား မဖျက်ရ
      if (dir.angleTo(down) < 0.7) continue;
      const target = new THREE.Vector3(sign * Math.sin(OUT), -Math.cos(OUT), 0.05)
        .normalize().applyQuaternion(modelQ);
      qw.setFromUnitVectors(dir, target);
      if (bone.parent) bone.parent.getWorldQuaternion(pw); else pw.identity();
      // W' = qw·W ၊ W = P·L  ⇒  L' = P⁻¹·qw·P·L
      const local = pw.clone().invert().multiply(qw).multiply(pw).multiply(bone.quaternion);
      bone.quaternion.copy(local);
      this.rest[key] = local.clone();
      // ★ ကလေးအရိုးတွေ ရွေ့သွားပြီ — နောက်တစ်ဖက် တွက်ခင် matrix ပြန်update
      model.updateWorldMatrix(true, true);
    }
  }

  /// တံတောင် အနည်းငယ် ကွေး — ဆန့်တန်းနေတဲ့ လက်က တုတ်ချောင်းလို ဖြစ်တယ်
  _bendElbows() {
    for (const key of ['lForeArm', 'rForeArm']) {
      const bone = this.bones[key], axis = this.axes?.[key];
      if (!bone || !axis) continue;
      const q = new THREE.Quaternion().setFromAxisAngle(axis, -0.22);
      const local = this.rest[key].clone().multiply(q);
      bone.quaternion.copy(local);
      this.rest[key] = local;
    }
  }

  /// အရိုးတိုင်းအတွက် "ဘယ်-ညာ ဝင်ရိုး" ကို local frame ထဲ တစ်ခါတည်း တွက်
  _computeAxes() {
    this.axes = {};
    this._q = new THREE.Quaternion();
    const parentWorld = new THREE.Quaternion();
    const boneWorld = new THREE.Quaternion();
    const inv = new THREE.Quaternion();
    // ခန္ဓာကိုယ်ရဲ့ ညာဘက် (world) — model ကို လှည့်ထားရင်ပါ မှန်အောင်
    this.model.updateWorldMatrix(true, true);
    const modelQ = new THREE.Quaternion();
    this.model.getWorldQuaternion(modelQ);
    const rightWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(modelQ);
    for (const [k, bone] of Object.entries(this.bones)) {
      bone.getWorldQuaternion(boneWorld);
      if (bone.parent) bone.parent.getWorldQuaternion(parentWorld);
      else parentWorld.identity();
      // အရိုးရဲ့ rest world frame ရဲ့ ပြောင်းပြန် → world ဝင်ရိုးကို local သို့
      inv.copy(boneWorld).invert();
      this.axes[k] = rightWorld.clone().applyQuaternion(inv).normalize();
    }
  }

  /// 🪑 ထိုင် pose — clip mode ရော bones mode ရော တူညီတယ်
  /// (sit clip ပါတဲ့ GLB မရှိသလောက်ဖြစ်လို့ procedural ပဲ သုံးတယ်)
  _applySit() {
    const b = this.bones, k = this.sitAmt;
    if (!b.lUpLeg || !b.rUpLeg) return;
    // ★ ထိုင်တာလည်း **ဘယ်-ညာ ဝင်ရိုး**ပတ်ပဲ ကွေးရမယ် — မဟုတ်ရင်
    //   ခြေထောက် ဘေးကို ဆွဲကားပြီး ထိုင်သလို မဖြစ်ဘူး။
    if (!this.axes) this._computeAxes();
    const q = this._q || (this._q = new THREE.Quaternion());
    const blendTo = (key, x) => {
      const bone = b[key];
      if (!bone || !this.axes[key]) return;
      q.setFromAxisAngle(this.axes[key], x * k);
      // clip mode မှာ mixer က pose ချထားပြီးသား — အပေါ်က ထပ်ထည့်တယ်
      bone.quaternion.multiply(q);
    };
    blendTo('lUpLeg', -1.45);
    blendTo('rUpLeg', -1.45);
    blendTo('lLeg', 1.5);
    blendTo('rLeg', 1.5);
    blendTo('spine', 0.12);
    // ★ တင်ပါး နိမ့်ချမှုကို **တင်ပါးအမြင့်ရဲ့ ရာခိုင်နှုန်း**နဲ့ တွက်တယ် —
    //   px အသေ ထားရင် cm ယူနစ်နဲ့ ဆောက်ထားတဲ့ rig မှာ လုံးဝ မထိရောက်ဘူး။
    if (b.hips) b.hips.position.y = this.restHipY * (1 - 0.4 * k);
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
