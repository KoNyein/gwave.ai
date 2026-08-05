// garage/Garage.js — configurator UI + build state (FeelFPV garage style)
import { PARTS, DEFAULT_BUILD, computeBuild } from './PartCatalog.js';

const KEY = 'gwave_drone_build_v1';

export class Garage {
  constructor(onApply /* (buildPhysics, colors) */, vo) {
    this.onApply = onApply;
    this.vo = vo;
    this.build = this._load();
    this.tab = 'propeller';
    this.open = false;
    this.el = document.getElementById('garage');
    this._wire();
    this.apply(false);
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...structuredClone(DEFAULT_BUILD), ...JSON.parse(raw) };
    } catch (_) {}
    return structuredClone(DEFAULT_BUILD);
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.build)); return true; }
    catch (_) { return false; }
  }

  toggle(show = !this.open) {
    this.open = show;
    this.el?.classList.toggle('open', show);
    if (show) this.render();
  }

  apply(announce = true) {
    const result = computeBuild(this.build);
    this.result = result;
    this.onApply(result.physics, this.build.colors);
    if (announce) this.vo?.(result.hint, 'info');
    return result;
  }

  _wire() {
    if (!this.el) return;
    this.el.addEventListener('click', e => {
      const t = e.target;
      if (t.dataset.tab) { this.tab = t.dataset.tab; this.render(); }
      if (t.dataset.part) {
        this.build[this.tab] = t.dataset.part;
        this.apply();
        this.render();
      }
      if (t.id === 'g-save') {
        const ok = this.save();
        this.vo?.(ok ? 'Build သိမ်းပြီး' : 'Storage မရ — session သာ', 'info');
      }
      if (t.id === 'g-testfly') {
        this.toggle(false);
        this.onTestFly?.();
      }
      if (t.id === 'g-close') this.toggle(false);
    });
    this.el.addEventListener('input', e => {
      const c = e.target.dataset.color;
      if (c) { this.build.colors[c] = e.target.value; this.apply(false); }
    });
  }

  render() {
    if (!this.el) return;
    const r = this.result ?? this.apply(false);
    const s = r.spec;
    const bar = (v, max, color) =>
      `<div class="g-bar"><div style="width:${Math.min(100, v / max * 100)}%;background:${color}"></div></div>`;
    this.el.innerHTML = `
      <div class="g-head">
        <span>🔧 GARAGE — Drone Configurator</span>
        <button id="g-close">✕</button>
      </div>
      <div class="g-tabs">
        ${Object.entries(PARTS).map(([k, p]) =>
          `<button data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${p.label}</button>`).join('')}
      </div>
      <div class="g-parts">
        ${Object.entries(PARTS[this.tab].items).map(([id, p]) => `
          <button data-part="${id}" class="g-part ${this.build[this.tab] === id ? 'on' : ''}">
            <b>${p.name}</b><small>${p.desc}</small>
          </button>`).join('')}
      </div>
      <div class="g-colors">
        <label>Frame <input type="color" data-color="frame" value="${this.build.colors.frame}"></label>
        <label>Props <input type="color" data-color="props" value="${this.build.colors.props}"></label>
        <label>Batt <input type="color" data-color="battery" value="${this.build.colors.battery}"></label>
      </div>
      <div class="g-spec">
        <div>Weight <b>${s.massG}g</b></div>
        <div>TWR <b>${s.twr}</b>${bar(s.twr, 9, '#35e0b8')}</div>
        <div>Top speed <b>${s.topSpeed} km/h</b>${bar(s.topSpeed, 200, '#e0355f')}</div>
        <div>Flight time <b>${s.flightTime}s</b>${bar(s.flightTime, 420, '#4a7dff')}</div>
        <div>Agility <b>${s.agility}</b>${bar(s.agility, 2, '#ffd24d')}</div>
        <div class="g-hint">${r.hint}</div>
      </div>
      <div class="g-actions">
        <button id="g-save">💾 SAVE</button>
        <button id="g-testfly">🚁 TEST FLY</button>
      </div>`;
  }
}
