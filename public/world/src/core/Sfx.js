// ============================================================
// Sfx.js — လောကရဲ့ **အသံ** (WebAudio synth)
//
// user: "တချို့ rooms တွေမှာ သေနတ်သံ ဗုံးအသံ မပါဘူး"
//
// အမှန်က — Open World မှာ **အသံ တစ်ခုမှ မရှိခဲ့ဘူး**။ voice chat ကလွဲပြီး
// ဖိုင်တစ်ခုမှ မဖွင့်ဘူး၊ AudioContext တစ်ခုမှ မဆောက်ဘူး။ ပစ်လည်း တိတ်၊
// ပေါက်ကွဲလည်း တိတ်၊ ခြေသံလည်း မရှိ။
//
// ★ **ဖိုင် မသုံးဘူး — အသံကို ကိုယ်တိုင် ဆင့်တယ်**。 mp3 ထည့်ရင်:
//   · ဖုန်းမှာ တစ်ခုချင်း download ဆွဲရမယ် (ပထမ ပစ်ချက် တိတ်နေမယ်)
//   · repo ထဲ binary တွေ တက်လာမယ်
//   WebAudio က noise burst + envelope နဲ့ ပစ်သံ/ဗုံးသံ ဆင့်လို့ ရတယ်၊
//   latency သုည၊ ဖိုင် သုည။
// ★ Autoplay policy — user တစ်ချက် ထိပြီးမှ AudioContext ကို resume လုပ်ရ
//   တယ်၊ မဟုတ်ရင် ဘယ်အသံမှ မထွက်ဘူး (ဒါက အသံ မထွက်တဲ့ အဖြစ်များဆုံး
//   အကြောင်းရင်း)。
// ============================================================

const KEY = 'gw.world.sfx';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    try {
      const v = localStorage.getItem(KEY);
      if (v != null) this.enabled = v === '1';
    } catch { /* private mode */ }

    // ★ ပထမဆုံး ထိမှုမှာ ဖွင့် — autoplay policy က ဒါကို မဖြစ်မနေ လိုတယ်
    const wake = () => this._ensure();
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      addEventListener(ev, wake, { once: false, passive: true });
    }
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.85 : 0;
      this.master.connect(this.ctx.destination);
      // 🔋 tab နောက်ကွယ် ရောက်ရင် audio graph ကို ရပ် — CPU ချွေတယ်
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else if (this.enabled) this.ctx.resume().catch(() => {});
      });
    }
    if (this.ctx.state === 'suspended' && this.enabled) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(on) {
    const was = this.enabled;
    this.enabled = !!on;
    // ပိတ်ရင် ambient ရပ်, ပြန်ဖွင့်ရင် ပြန်စ
    if (was && !this.enabled) { const k = this._ambKind; this._stopAmbient(); this._ambKind = null; this._pendingAmb = k; }
    else if (!was && this.enabled && this._pendingAmb) {
      const k = this._pendingAmb; this._pendingAmb = null; this._ambKind = null;
      setTimeout(() => this.ambient(k), 0);
    }
    try { localStorage.setItem(KEY, this.enabled ? '1' : '0'); } catch { /* private */ }
    if (this.master) this.master.gain.value = this.enabled ? 0.85 : 0;
    if (this.enabled) this._ensure();
    return this.enabled;
  }
  toggle() { return this.setEnabled(!this.enabled); }

  /// အသံဆူညံ buffer — ပစ်သံ/ဗုံးသံ နှစ်ခုလုံးရဲ့ အခြေခံ
  _noise(dur) {
    const ctx = this.ctx;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /// gain က ဝေးရင် သေး — StrikeRoom က bot အကွာအဝေး ထည့်ပေးတယ်
  _gain(vol = 1) {
    const g = this.ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, vol));
    g.connect(this.master);
    return g;
  }

  /// 🔫 ပစ်သံ — ဆူညံသံ ဖောက်ခွဲမှု + နိမ့်သံ တုန်ခါမှု
  shot({ vol = 1, weapon = 'rifle' } = {}) {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const out = this._gain(vol * 0.55);

    // ① crack — ဆူညံသံကို band-pass ဖြတ်ပြီး ချက်ချင်း ကျဆင်း
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = weapon === 'pistol' ? 1800 : 1200;
    bp.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + (weapon === 'pistol' ? 0.09 : 0.14));
    src.connect(bp).connect(env).connect(out);
    src.start(t); src.stop(t + 0.2);

    // ② thump — နိမ့်သံ (ရင်ဘတ်ထဲ ခံစားရတဲ့ အပိုင်း)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(0.9, t);
    oe.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(oe).connect(out);
    osc.start(t); osc.stop(t + 0.18);
  }

  /// 💥 ဗုံးသံ — ရှည်တဲ့ ဆူညံသံ + low-pass ကျဆင်း + နက်တဲ့ တုန်ခါမှု
  explosion({ vol = 1 } = {}) {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const out = this._gain(vol * 0.75);

    const src = ctx.createBufferSource();
    src.buffer = this._noise(1.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.9);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    src.connect(lp).connect(env).connect(out);
    src.start(t); src.stop(t + 1.1);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(1, t);
    oe.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(oe).connect(out);
    osc.start(t); osc.stop(t + 0.65);
  }

  /// 🎯 ထိသံ — တိုတိုတုတ်တုတ်
  hit({ vol = 1, head = false } = {}) {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const out = this._gain(vol * 0.5);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(head ? 1400 : 820, t);
    osc.frequency.exponentialRampToValueAtTime(head ? 700 : 380, t + 0.07);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.6, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(e).connect(out);
    osc.start(t); osc.stop(t + 0.1);
  }

  /// 🔄 ကျည်ထည့်သံ — ကလစ် နှစ်ချက်
  reload() {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    for (const [d, f] of [[0, 900], [0.16, 1300]]) {
      const t = ctx.currentTime + d;
      const out = this._gain(0.35);
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.5, t);
      e.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(e).connect(out);
      osc.start(t); osc.stop(t + 0.06);
    }
  }

  /// 👟 ခြေသံ — ဖျော့ဖျော့ ဆူညံသံ တစ်ချက်
  step({ vol = 1 } = {}) {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const out = this._gain(vol * 0.16);
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.07);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700 + Math.random() * 300;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.9, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(lp).connect(e).connect(out);
    src.start(t); src.stop(t + 0.09);
  }

  /// ✨ UI / တံခါးဖွင့် — သာယာတဲ့ blip
  ui({ up = true } = {}) {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const out = this._gain(0.3);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(up ? 620 : 520, t);
    osc.frequency.exponentialRampToValueAtTime(up ? 940 : 330, t + 0.09);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.5, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(e).connect(out);
    osc.start(t); osc.stop(t + 0.16);
  }

  // ══════════════════════════════════════════════════════════════════
  // 🎧 **ပတ်ဝန်းကျင် အသံ** (ambient) — အခန်းအလိုက် အဆက်မပြတ်
  //
  // user: "အသံ မကြားရဘူး"
  //
  // အရင်က ပစ်သံ/ခြေသံ လို **တစ်ချက်တည်း** အသံတွေပဲ ရှိတယ် — လမ်းလျှောက်
  // ရုံနဲ့ ဘာမှ မကြားရဘူး၊ လောကက တိတ်ဆိတ်နေတယ်။ ဒါက အသံ "ပျက်နေတာ"
  // မဟုတ်ဘဲ **မရှိတာ** ဖြစ်တယ်။
  //
  // ★ ဖိုင် မသုံးဘူး — ဆူညံသံကို filter နဲ့ ပုံဖော်တယ်:
  //     city — နိမ့်တဲ့ ဟိန်းသံ (ကားလမ်း, လူစည်ကား)
  //     sea  — ဒီလှိုင်း (bandpass ကို ဖြည်းဖြည်း လှိမ့်)
  //     wind — တောင်ပေါ်လေ (မြင့်တဲ့ ဆူညံသံ ဖျော့ဖျော့)
  //     none — တိတ်
  // ★ Loop က `loop = true` ဖြစ်တဲ့ buffer တစ်ခုတည်း — CPU အလွန်နည်း။
  // ══════════════════════════════════════════════════════════════════

  /// အခန်းကူးတိုင်း ခေါ်တယ်။ တူညီတဲ့ အမျိုးအစားဆို ဘာမှ မလုပ်ဘူး။
  ambient(kind = 'none') {
    if (this._ambKind === kind) return;
    this._ambKind = kind;
    this._stopAmbient();
    if (kind === 'none') return;
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;

    const src = ctx.createBufferSource();
    src.buffer = this._noise(4);          // ၄ စက္ကန့် — loop လုပ်လို့ လုံလောက်
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();

    if (kind === 'city') {
      f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 0.6;
      g.gain.value = 0.045;
    } else if (kind === 'sea') {
      f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 0.7;
      g.gain.value = 0.075;
      // 🌊 လှိုင်း — ၇ စက္ကန့် တစ်ခေါက် တက်/ကျ
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.14;
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      this._ambLfo = lfo;
    } else {   // wind
      f.type = 'highpass'; f.frequency.value = 620; f.Q.value = 0.4;
      g.gain.value = 0.035;
    }
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this._amb = { src, g, ctx };
  }

  _stopAmbient() {
    if (this._ambLfo) { try { this._ambLfo.stop(); } catch { /* stopped */ } this._ambLfo = null; }
    if (!this._amb) return;
    try { this._amb.src.stop(); } catch { /* already stopped */ }
    this._amb = null;
  }

  /// 🌀 အခန်းကူးသံ — filtered noise sweep
  whoosh() {
    const ctx = this._ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const out = this._gain(0.32);
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.55);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.001, t);
    e.gain.exponentialRampToValueAtTime(0.7, t + 0.16);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(bp).connect(e).connect(out);
    src.start(t); src.stop(t + 0.55);
  }
}

/// လောကတစ်ခုလုံးအတွက် တစ်ခုတည်း
export const sfx = new Sfx();
