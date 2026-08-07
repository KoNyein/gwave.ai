// ============================================================
// Emotes.js — Gesture Emote စနစ် (procedural animation)
// Avatar placeholder rig (body capsule + head) ကို emote အလိုက် လှုပ်ရှားစေသည်
// GLB avatar ရှိလျှင် group တစ်ခုလုံးကို လှုပ်ပေးမည် (Mixamo clip မလိုဘဲ အလုပ်လုပ်)
//
// Emote အားလုံး multiplayer sync ဖြစ်သည် (snapshot 'e' field)
// ============================================================

export const EMOTES = [
  { id: 'wave',   name_mm: '👋 နှုတ်ဆက်',   dur: 2.4 },
  { id: 'cheer',  name_mm: '🙌 အားပေး',     dur: 2.2 },
  { id: 'clap',   name_mm: '👏 လက်ခုပ်',    dur: 2.0 },
  { id: 'dance',  name_mm: '🕺 ကခုန်',      dur: 4.0 },
  { id: 'bow',    name_mm: '🙇 ဦးညွှတ်',    dur: 2.2 },
  { id: 'sit',    name_mm: '🪑 ထိုင်',       dur: 6.0 },
  { id: 'point',  name_mm: '👉 လက်ညှိုးထိုး', dur: 2.0 },
  { id: 'think',  name_mm: '🤔 စဉ်းစား',    dur: 3.0 },
];
export const emoteById = Object.fromEntries(EMOTES.map(e => [e.id, e]));

// target = { group, placeholder } — Avatar သို့ RemotePlayer
export class EmotePlayer {
  constructor(target) {
    this.target = target;   // { group } — လှုပ်မည့် object
    this.current = null;
    this.t = 0;
    this.baseY = 0;
  }

  play(id) {
    const def = emoteById[id];
    if (!def) return;
    this.current = def;
    this.t = 0;
  }

  stop() {
    this.current = null;
    this.applyReset();
  }

  applyReset() {
    const g = this.target.group;
    if (!g) return;
    g.rotation.x = 0; g.rotation.z = 0;
    if (g.userData.emoteYOffset) {
      g.position.y -= g.userData.emoteYOffset;
      g.userData.emoteYOffset = 0;
    }
    if (this.inner) { this.inner.rotation.set(0, 0, 0); this.inner.position.y = 0; }
  }

  // Avatar ရဲ့ ခန္ဓာကိုယ်အလွှာ ကို ရွေ့မည်
  //
  // ★ အရင်က `children[0]` ကို ယူတယ် — ဒါက **placeholder capsule**。
  //   setModel() က placeholder ကို `visible=false` ပဲ လုပ်ပြီး မဖြုတ်လို့
  //   GLB avatar ရှိသူတွေမှာ emote က မမြင်ရတဲ့ capsule ကိုပဲ လှုပ်နေတယ် —
  //   တကယ့် ခန္ဓာကိုယ်က ငြိမ်နေတယ် (user: "ထိုင်တာ ထတာ မလုပ်ဘူး")。
  //   အခု **မြင်ရတဲ့** အလွှာကို ရွေးတယ်။
  get inner() {
    const g = this.target.group;
    if (!g?.children?.length) return null;
    if (this.target.model) return this.target.model;
    return g.children.find((c) => c.visible && !c.isSprite) || g.children[0];
  }

  update(dt) {
    if (!this.current) return;
    this.t += dt;
    const d = this.current, p = this.t / d.dur; // 0→1
    if (p >= 1) { this.stop(); return; }

    const inner = this.inner;
    if (!inner) return;
    const s = (f) => Math.sin(this.t * f);

    switch (d.id) {
      case 'wave':   inner.rotation.z = s(9) * 0.35; inner.rotation.x = -0.1; break;
      case 'cheer':  inner.position.y = Math.abs(s(7)) * 0.28; inner.rotation.x = -0.18; break;
      case 'clap':   inner.rotation.y = s(14) * 0.16; inner.position.y = Math.abs(s(14)) * 0.05; break;
      case 'dance':  inner.rotation.z = s(6) * 0.28; inner.rotation.y = s(3) * 0.5;
                     inner.position.y = Math.abs(s(6)) * 0.2; break;
      case 'bow':    inner.rotation.x = Math.sin(Math.min(1, p * 2) * Math.PI) * 0.75; break;
      // 🪑 ထိုင်တာက gesture မဟုတ်ဘူး — အနေအထား (posture)。 Skeleton ရှိရင်
      // Locomotion က ခြေထောက် ကွေးပေးတယ် (Avatar.setSitting)၊ ဒီက
      // placeholder capsule အတွက်သာ။
      case 'sit':    if (!this.target.loco) { inner.position.y = -0.42; inner.rotation.x = 0.12; } break;
      case 'point':  inner.rotation.y = 0.4; inner.rotation.z = -0.2 - s(5) * 0.05; break;
      case 'think':  inner.rotation.x = 0.12; inner.rotation.y = s(1.5) * 0.22; break;
    }
  }
}
