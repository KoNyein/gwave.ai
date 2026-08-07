// ============================================================
// RadialMenu.js — Metaverse Radial Menu (☰ / [M])
// မိုဘိုင်း metaverse app များ၏ gesture-wheel ပုံစံ — ဗဟို ☰ ခလုတ်နှိပ်လျှင်
// system function အားလုံး စက်ဝိုင်းပုံ ပွင့်ထွက်လာသည် (touch + mouse)
// ============================================================
export class RadialMenu {
  constructor(items, hud) {
    this.items = items; // [{ icon, label, action }]
    this.open = false;

    // ဗဟို FAB ခလုတ်
    this.fab = document.createElement('button');
    this.fab.id = 'radialFab';
    this.fab.textContent = '☰';
    document.body.appendChild(this.fab);

    // Item container
    this.wrap = document.createElement('div');
    this.wrap.id = 'radialWrap';
    document.body.appendChild(this.wrap);

    const R = 118; // အချင်းဝက်
    const start = Math.PI * 0.95, end = Math.PI * 0.05; // အပေါ်ဘက် ခြမ်းဝိုင်း
    items.forEach((item, i) => {
      const a = start + (end - start) * (i / (items.length - 1));
      const el = document.createElement('button');
      el.className = 'radialItem';
      el.innerHTML = `<span class="ri">${item.icon}</span><span class="rl">${item.label}</span>`;
      el.style.setProperty('--tx', `${Math.cos(a) * R}px`);
      el.style.setProperty('--ty', `${-Math.sin(a) * R}px`);
      el.addEventListener('click', () => { this.toggle(false); item.action(); });
      this.wrap.appendChild(el);
    });

    this.fab.addEventListener('click', () => this.toggle());
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    this.fab.classList.toggle('open', this.open);
    this.wrap.classList.toggle('open', this.open);
  }
}
