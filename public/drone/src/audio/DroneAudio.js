// audio/DroneAudio.js — physics-driven motor sound (task 2.4)
// motor value 4 ခု → oscillator 4 လုံး pitch/gain — throttle punch ရင် pitch တက် (FPV အသံစစ်)
export class DroneAudio {
  constructor() {
    this.ctx = null;
    this.voices = [];
    this.master = null;
    this._beepT = 0;
    // first user gesture မှ AudioContext ဖွင့် (browser policy)
    const unlock = () => {
      if (this.ctx) return;
      this._init();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  _init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    // motor voices ×4: saw osc → lowpass → gain
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 80;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0;
      osc.connect(lp).connect(g).connect(this.master);
      osc.start();
      // detune စက်တစ်လုံးချင်း character
      osc.detune.value = (i - 1.5) * 9;
      this.voices.push({ osc, g, lp });
    }
  }

  // frame တိုင်းခေါ် — motors [0..1]×4
  update(motors, armed, voltage, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const m = armed ? motors[i] : 0;
      const v = this.voices[i];
      // pitch: idle 90Hz → full ~750Hz (+ RPM harmonic feel via filter)
      v.osc.frequency.setTargetAtTime(90 + m * m * 660, t, 0.02);
      v.lp.frequency.setTargetAtTime(400 + m * 2600, t, 0.03);
      v.g.gain.setTargetAtTime(m * 0.055, t, 0.02);
    }
    // low battery beep (21.4V အောက် 0.8s ခြား)
    if (armed && voltage < 21.4) {
      this._beepT += dt;
      if (this._beepT > 0.8) { this._beepT = 0; this.beep(2200, 0.09, 0.2); }
    }
  }

  beep(freq = 1500, dur = 0.08, vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur);
  }
  armBeep() { this.beep(1200, 0.07); setTimeout(() => this.beep(1800, 0.07), 90); }
  disarmBeep() { this.beep(900, 0.12); }
  gateBeep() { this.beep(2400, 0.06, 0.3); }

  explosion(radius = 6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, dur = 0.6 + radius * 0.06;
    const len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain(); g.gain.value = Math.min(1, 0.5 + radius * 0.07);
    src.connect(lp).connect(g).connect(this.master); src.start(t);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + dur);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.8, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g2).connect(this.master); o.start(t); o.stop(t + dur);
  }
  bark(aggressive = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(aggressive ? 340 : 420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.12);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.15);
    setTimeout(() => { const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth';
      const t2 = this.ctx.currentTime;
      o2.frequency.setValueAtTime(380, t2);
      o2.frequency.exponentialRampToValueAtTime(150, t2 + 0.1);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.35, t2);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12);
      o2.connect(g2).connect(this.master); o2.start(t2); o2.stop(t2 + 0.13);
    }, 140);
  }

  gunshot(freq = 200, dur = 0.1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // crack: noise burst highpass + body thump osc
    const len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const g1 = this.ctx.createGain(); g1.gain.value = 0.5;
    src.connect(hp).connect(g1).connect(this.master); src.start(t);
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(45, t + dur);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.55, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g2).connect(this.master); o.start(t); o.stop(t + dur);
  }
  reloadClick() {
    this.beep(500, 0.04, 0.2);
    setTimeout(() => this.beep(700, 0.04, 0.2), 350);
    setTimeout(() => this.beep(1100, 0.05, 0.25), 900);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // noise burst
    const len = this.ctx.sampleRate * 0.25;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = 0.7;
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
  }
}
