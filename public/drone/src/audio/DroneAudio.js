/**
 * Phase 2.4 — physics-driven drone sound (PHASES.md):
 * 4 oscillators, one per motor — pitch follows the motor output the physics
 * computed, so punch-outs and yaw spins SOUND like a real quad. Plus crash
 * burst and low-battery beeps. Started lazily on first arm (autoplay rules).
 */
export class DroneAudio {
  constructor() {
    this.ctx = null;
    this.osc = [];
    this.gains = [];
    this.master = null;
    this.beepAt = 0;
  }

  _ensure() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.12;
    this.master.connect(ctx.destination);
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 80;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.master);
      o.start();
      this.osc.push(o);
      this.gains.push(g);
    }
  }

  update(motors, armed, batteryV, lowV) {
    if (!armed) {
      if (this.ctx) this.gains.forEach((g) => g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06));
      return;
    }
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    motors.forEach((m, i) => {
      // idle whine 90Hz → full-throttle ~520Hz, slight per-motor detune
      this.osc[i].frequency.setTargetAtTime(90 + m * 430 + i * 7, t, 0.03);
      this.gains[i].gain.setTargetAtTime(0.05 + m * 0.2, t, 0.04);
    });
    // low battery: double beep every 1.2s
    if (batteryV < lowV && t > this.beepAt) {
      this.beepAt = t + 1.2;
      this._beep(t, 1320);
      this._beep(t + 0.18, 1320);
    }
  }

  crash() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = 0.25 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  _beep(t, freq) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.setTargetAtTime(0, t + 0.1, 0.02);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}
