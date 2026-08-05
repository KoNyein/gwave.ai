// SettingsUI.js — FeelFPV-style rates & controller panel
import { actualRate } from './DronePhysics.js';
import { DEFAULT_CONFIG, saveConfig } from './config.js';

export class SettingsUI {
  constructor(cfg, controller, onChange) {
    this.cfg = cfg; this.ctl = controller; this.onChange = onChange;
    this.panel = document.getElementById('settings');
    document.getElementById('gear').onclick = () => this.panel.classList.toggle('open');
    addEventListener('keydown', e => { if (e.code === 'Escape') this.panel.classList.toggle('open'); });

    this._buildRates();
    this._buildSteppers();
    this._buildToggles();

    document.getElementById('autobind').onclick = () => {
      const st = document.getElementById('bind-status');
      this.ctl.startAutoBind(msg => st.textContent = msg, () => this.onChange());
    };
    document.getElementById('save').onclick = () => {
      const ok = saveConfig(this.cfg);
      document.getElementById('bind-status').textContent =
        ok ? '✔ သိမ်းပြီးပါပြီ' : '⚠ storage မရ — session memory ထဲသာ';
    };
    document.getElementById('reset-cfg').onclick = () => {
      Object.assign(this.cfg, structuredClone(DEFAULT_CONFIG));
      this._refreshAll(); this.onChange();
    };
    this.drawCurve();
    setInterval(() => {
      document.getElementById('active-axis').textContent = this.ctl.activeAxis;
    }, 200);
  }

  _buildRates() {
    const host = document.getElementById('rates-rows');
    const axes = [['roll','ROLL','#e0355f'], ['pitch','PITCH','#3ae035'], ['yaw','YAW','#3577e0']];
    const params = [['centerSens','Sens',25,0,400], ['maxRate','Rate',50,100,1200], ['expo','Expo',0.05,0,1]];
    host.innerHTML = '';
    for (const [key, label, color] of axes) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label style="color:${color};min-width:48px">${label}</label>`;
      for (const [p, , step, min, max] of params) {
        row.appendChild(this._stepper(
          () => this.cfg.rates[key][p],
          v => { this.cfg.rates[key][p] = v; this.drawCurve(); },
          step, min, max, p === 'expo' ? 2 : 0));
      }
      host.appendChild(row);
    }
  }

  _stepper(get, set, step, min, max, decimals = 0) {
    const el = document.createElement('div');
    el.className = 'stepper';
    const span = document.createElement('span');
    const fmt = () => span.textContent = get().toFixed(decimals);
    const btn = (txt, dir) => {
      const b = document.createElement('button');
      b.textContent = txt;
      b.onclick = () => {
        set(Math.min(max, Math.max(min, +(get() + dir * step).toFixed(4))));
        fmt(); this.onChange();
      };
      return b;
    };
    el.append(btn('◀', -1), span, btn('▶', 1));
    fmt();
    return el;
  }

  _buildSteppers() {
    document.querySelectorAll('.stepper[data-cfg]').forEach(host => {
      const key = host.dataset.cfg;
      const step = +host.dataset.step, min = +host.dataset.min, max = +host.dataset.max;
      const unit = host.dataset.unit ?? '';
      const span = document.createElement('span');
      const fmt = () => span.textContent = this.cfg[key] + unit;
      const btn = (txt, dir) => {
        const b = document.createElement('button'); b.textContent = txt;
        b.onclick = () => {
          this.cfg[key] = Math.min(max, Math.max(min, this.cfg[key] + dir * step));
          fmt(); this.onChange();
        };
        return b;
      };
      host.append(btn('◀', -1), span, btn('▶', 1));
      fmt();
    });
  }

  _buildToggles() {
    document.querySelectorAll('.toggle[data-tgl]').forEach(t => {
      const key = t.dataset.tgl;
      const sync = () => t.classList.toggle('on', !!this.cfg[key]);
      t.onclick = () => { this.cfg[key] = !this.cfg[key]; sync(); this.onChange(); };
      sync();
    });
  }

  _refreshAll() { this._buildRates(); this.drawCurve();
    document.querySelectorAll('.stepper[data-cfg]').forEach(h => h.innerHTML = '');
    this._buildSteppers(); this._buildToggles();
  }

  drawCurve() {
    const cv = document.getElementById('ratecurve');
    const ctx = cv.getContext('2d');
    const W = cv.width = cv.clientWidth * 2, H = cv.height = 300;
    ctx.clearRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = '#182238'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H);
    ctx.moveTo(0, H/2); ctx.lineTo(W, H/2);
    ctx.stroke();
    // linear reference (orange, FeelFPV style)
    ctx.strokeStyle = '#c8722a'; ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke();
    // per-axis curves
    const colors = { roll: '#e0355f', pitch: '#3ae035', yaw: '#4a7dff' };
    for (const axis of ['roll', 'pitch', 'yaw']) {
      const r = this.cfg.rates[axis];
      ctx.strokeStyle = colors[axis]; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const x = -1 + i / 50;
        const y = actualRate(x, r) / Math.max(1, r.maxRate); // normalize
        const px = (x + 1) / 2 * W, py = H/2 - y * H/2;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#5f7096'; ctx.font = '20px monospace';
    ctx.fillText('deg/s vs stick', 10, 24);
  }
}
