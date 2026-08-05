// Controller.js — input sources: Gamepad (incl. ELRS USB radio) > Touch > Keyboard
const THREE_CLAMP = v => Math.min(1, Math.max(0, v));
export class Controller {
  constructor(cfg) {
    this.cfg = cfg;
    this.out = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };
    this.events = { arm: false, reset: false, modeToggle: false };
    this.activeAxis = 'NONE';
    this.deadzone = 0.03;
    this._keys = {};
    this._kbThrottle = 0;
    this._binding = null;            // auto-bind state
    this._baseline = null;
    this.touch = { l: { x: 0, y: 0, active: false }, r: { x: 0, y: 0, active: false } };
    this._lastButtons = [];

    addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'Space') this.events.arm = true;
      if (e.code === 'KeyR') this.events.reset = true;
      if (e.code === 'KeyM') this.events.modeToggle = true;
    });
    addEventListener('keyup', e => this._keys[e.code] = false);
    this._initTouch();
  }

  // ---------- AUTO BIND ----------
  startAutoBind(onStatus, onDone) {
    const order = ['throttle', 'yaw', 'pitch', 'roll'];
    const labels = { throttle: 'Throttle stick (အပေါ်တင်ပါ)', yaw: 'Yaw stick (ဘယ်ညာ)',
                     pitch: 'Pitch stick (ရှေ့နောက်)', roll: 'Roll stick (ဘယ်ညာ)' };
    let idx = 0;
    const gp = this._gamepad();
    this._baseline = gp ? [...gp.axes] : null;
    if (!this._baseline) { onStatus('❌ Gamepad/Radio မတွေ့ပါ — ခလုတ်တစ်ခုနှိပ်ပြီး ပြန်စမ်းပါ'); return; }
    onStatus(`▶ ${labels[order[0]]}`);
    this._binding = { order, idx, labels, onStatus, onDone, cooldown: 0 };
  }

  _pollAutoBind(gp, dt) {
    const b = this._binding;
    if (!b || !gp) return;
    if (b.cooldown > 0) { b.cooldown -= dt; return; }
    let best = -1, bestDelta = 0.55;                 // threshold
    gp.axes.forEach((v, i) => {
      const d = Math.abs(v - this._baseline[i]);
      if (d > bestDelta) { bestDelta = d; best = i; }
    });
    if (best >= 0) {
      const axisName = b.order[b.idx];
      this.cfg.bindings[axisName] = best;
      b.idx++;
      if (b.idx >= b.order.length) {
        b.onStatus('✔ Bind ပြီးပါပြီ — ' + JSON.stringify(this.cfg.bindings));
        b.onDone?.(); this._binding = null;
      } else {
        b.onStatus(`✔ ${axisName} = axis_${best} · ▶ ${b.labels[b.order[b.idx]]}`);
        b.cooldown = 1.2;                            // stick ပြန်ချချိန်
        this._baseline = [...gp.axes];
      }
    }
  }

  _gamepad() {
    const gps = navigator.getGamepads?.() ?? [];
    for (const g of gps) if (g && g.connected) return g;
    return null;
  }

  _dz(v) { return Math.abs(v) < this.deadzone ? 0 : v; }

  update(dt) {
    const gp = this._gamepad();
    this._pollAutoBind(gp, dt);
    const c = this.cfg;
    let src = 'KB';

    if (this.xrSticks) {
      // ---- VR controllers = virtual radio (Mode 2) ----
      const s = this.xrSticks;
      this.out.throttle = THREE_CLAMP(0.5 - s.ly * 0.5);     // left Y: up→1
      this.out.yaw   = s.lx * (c.invYaw ? -1 : 1);
      this.out.pitch = s.ry * (c.invPitch ? -1 : 1);
      this.out.roll  = s.rx * (c.invRoll ? -1 : 1);
      this.source = 'VR';
      return this.out;
    }

    if (gp && !this._binding) {
      // ---- Gamepad / ELRS radio ----
      const ax = i => this._dz(gp.axes[i] ?? 0);
      let thrRaw = ax(c.bindings.throttle);
      if (c.invThrottle) thrRaw = -thrRaw;
      // radio (full-range stick): up(−1)→1.0, down(+1)→0
      // half-throttle (springy gamepad stick): center(0)→0.5, up→1.0, down→0
      this.out.throttle = c.halfThrottle
        ? THREE_CLAMP(0.5 - thrRaw * 0.5)
        : THREE_CLAMP(1 - (thrRaw + 1) / 2);
      this.out.pitch = ax(c.bindings.pitch) * (c.invPitch ? -1 : 1);
      this.out.roll  = ax(c.bindings.roll)  * (c.invRoll  ? -1 : 1);
      this.out.yaw   = ax(c.bindings.yaw)   * (c.invYaw   ? -1 : 1);
      // buttons: A(0)=arm toggle, B(1)=reset, Y(3)=mode
      const btn = i => gp.buttons[i]?.pressed && !this._lastButtons[i];
      if (btn(0)) this.events.arm = true;
      if (btn(1)) this.events.reset = true;
      if (btn(3)) this.events.modeToggle = true;
      this._lastButtons = gp.buttons.map(b => b.pressed);
      // active axis debug
      const moved = gp.axes.findIndex((v, i) => Math.abs(v - (this._prevAxes?.[i] ?? v)) > 0.02 && Math.abs(v) > 0.1);
      this.activeAxis = moved >= 0 ? `axis_${moved}` : this.activeAxis;
      this._prevAxes = [...gp.axes];
      src = 'GAMEPAD';
    } else if (this.touch.l.active || this.touch.r.active) {
      // ---- Touch (Mode 2: L=THR/YAW, R=PITCH/ROLL) ----
      this.out.throttle = Math.max(0, -this.touch.l.y * 0.5 + 0.5) * (this.touch.l.active ? 1 : 0);
      this.out.yaw   = this.touch.l.x * (c.invYaw ? -1 : 1);
      this.out.pitch = this.touch.r.y * (c.invPitch ? -1 : 1);
      this.out.roll  = this.touch.r.x * (c.invRoll ? -1 : 1);
      src = 'TOUCH';
    } else {
      // ---- Keyboard (Mode 2) ----
      const rate = dt * 1.4;
      if (this._keys['KeyW']) this._kbThrottle = Math.min(1, this._kbThrottle + rate);
      if (this._keys['KeyS']) this._kbThrottle = Math.max(0, this._kbThrottle - rate);
      this.out.throttle = this._kbThrottle;
      const t = (neg, pos) => (this._keys[neg] ? -1 : 0) + (this._keys[pos] ? 1 : 0);
      this.out.yaw   = t('KeyA', 'KeyD');
      this.out.pitch = t('ArrowDown', 'ArrowUp');
      this.out.roll  = t('ArrowLeft', 'ArrowRight');
    }
    this.source = src;
    return this.out;
  }

  consumeEvents() {
    const e = { ...this.events };
    this.events = { arm: false, reset: false, modeToggle: false };
    return e;
  }

  // ---------- Touch dual sticks ----------
  _initTouch() {
    if (!('ontouchstart' in window)) return;
    document.body.classList.add('touch');
    const setup = (zoneId, key) => {
      const zone = document.getElementById(zoneId);
      const base = zone.querySelector('.stick-base');
      const knob = zone.querySelector('.stick-knob');
      const R = 60;
      let origin = null, pid = null;
      zone.addEventListener('pointerdown', e => {
        pid = e.pointerId; origin = { x: e.clientX, y: e.clientY };
        base.style.display = 'block';
        base.style.left = e.clientX - zone.getBoundingClientRect().left + 'px';
        base.style.top  = e.clientY - zone.getBoundingClientRect().top + 'px';
        knob.style.left = '50%'; knob.style.top = '50%';
        this.touch[key].active = true;
        zone.setPointerCapture(pid);
      });
      zone.addEventListener('pointermove', e => {
        if (e.pointerId !== pid || !origin) return;
        let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = dx / len * R; dy = dy / len * R; }
        knob.style.left = 50 + (dx / R) * 42 + '%';
        knob.style.top  = 50 + (dy / R) * 42 + '%';
        this.touch[key].x = dx / R;
        this.touch[key].y = dy / R;
      });
      const end = e => {
        if (e.pointerId !== pid) return;
        pid = null; origin = null; base.style.display = 'none';
        this.touch[key] = { x: 0, y: 0, active: key === 'l' ? this.touch.l.active : false };
        if (key === 'l') { this.touch.l.active = false; this.touch.l.x = 0; /* throttle springs to 0 */ }
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
    };
    setup('zone-l', 'l');
    setup('zone-r', 'r');
  }
}
