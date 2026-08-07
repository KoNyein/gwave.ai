// ============================================================
// RadialMenu.js — Metaverse System Menu (☰ / [M])
//
// 📐 ပုံစံ နှစ်မျိုး — CSS က `body.touch` ကို ကြည့်ပြီး ရွေးတယ်:
//   · 🖥️ PC   — radial arc (gesture wheel)。 radius ကို item အရေအတွက်ကနေ
//               တွက်တယ် — အရင်က R=118px အသေ ထားလို့ item ၁၁ ခုက အချင်းချင်း
//               ထပ်ပြီး joystick/ခလုတ်တွေပေါ်ပါ တက်နေတယ်။
//   · 📱 ဖုန်း — arc လုံးဝ မသုံးဘူး၊ **၄ ကော်လံ grid sheet**。 item တိုင်း
//               74px မြင့်၊ label အပြည့် ဖတ်ရ၊ scroll လုပ်လို့ရ၊ ဘာနဲ့မှ မထပ်
//               (user: "menu button အရမ်းကြပ်အောင် မလုပ်ပါ")。
// ============================================================
export class RadialMenu {
  constructor(items, hud) {
    this.items = items; // [{ icon, label, action }]
    this.open = false;

    // ဗဟို FAB ခလုတ်
    this.fab = document.createElement('button');
    this.fab.id = 'radialFab';
    this.fab.textContent = '☰';
    this.fab.setAttribute('aria-label', 'Menu');
    document.body.appendChild(this.fab);

    // Sheet/arc ပွင့်ချိန် အပြင်ဘက် နှိပ်ရင် ပိတ်ဖို့ backdrop
    this.back = document.createElement('div');
    this.back.id = 'radialBack';
    document.body.appendChild(this.back);

    // Item container
    this.wrap = document.createElement('div');
    this.wrap.id = 'radialWrap';
    document.body.appendChild(this.wrap);

    // ── PC arc ရဲ့ radius — item တွေ မထပ်အောင် တွက် ────────────────────
    // Item တစ်ခု 64px + ကြား 20px = 84px。 arc တစ်ခုမှာ n ခု ထည့်ဖို့
    // arc အရှည် = 84(n-1) လိုတယ် → R = 84(n-1)/span。 (span က π မဟုတ်ဘူး —
    // 0.95π..0.05π ဆိုတော့ 0.9π ပဲ ရှိတယ်၊ အဲဒါ မတွက်လို့ ထပ်နေခဲ့တာ)。
    // ★ ဖန်သားပြင် ဘောင်ထဲ ကျန်အောင် အပေါ်က ကန့်သတ်တယ်။
    const n = Math.max(items.length, 2);
    const start = Math.PI * 0.95, end = Math.PI * 0.05; // အပေါ်ဘက် ခြမ်းဝိုင်း
    const span = Math.abs(end - start);
    const fit = Math.max(140, Math.floor(window.innerWidth / 2 - 44));
    const R = Math.min(fit, Math.max(120, Math.ceil((84 * (n - 1)) / span)));
    items.forEach((item, i) => {
      const a = start + (end - start) * (i / (n - 1));
      const el = document.createElement('button');
      el.className = 'radialItem';
      el.innerHTML = `<span class="ri">${item.icon}</span><span class="rl">${item.label}</span>`;
      el.style.setProperty('--tx', `${Math.cos(a) * R}px`);
      el.style.setProperty('--ty', `${-Math.sin(a) * R}px`);
      el.addEventListener('click', () => { this.toggle(false); item.action(); });
      this.wrap.appendChild(el);
    });

    this.fab.addEventListener('click', () => this.toggle());
    this.back.addEventListener('click', () => this.toggle(false));
    // ★ Esc နဲ့လည်း ပိတ်လို့ရ — ပွင့်ပြီး ပြန်မပိတ်နိုင်တာ အဖြစ်များတယ်
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.toggle(false);
    });
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    this.fab.classList.toggle('open', this.open);
    this.wrap.classList.toggle('open', this.open);
    this.back.classList.toggle('open', this.open);
  }
}
