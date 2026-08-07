// ============================================================
// RadialMenu.js — Metaverse System Menu (☰ / [M])
//
// 📐 **ဘေးအနားကပ် floating dock** — မျက်နှာပြင် အလယ်ကို ဘယ်တော့မှ မဖုံးဘူး
//    (user: "အလယ်မှာ view အရမ်းကွယ်လွန်းတယ် … နေရာမယူတဲ့ UI မျိုး")。
//
//    အရင် ပုံစံ ၂ ခုစလုံး လောကကို ဖုံးခဲ့တယ် — arc က အလယ်ကို ဖြတ်၊ grid
//    sheet က အောက်တစ်ဝက်ကို ပိတ်။ အခု ဘယ်ဘက် အနားမှာ ခလုတ်တန်း တစ်တန်း၊
//    နောက်ခံ မရှိ၊ scrim မရှိ — ခလုတ်ကြားက လောကကို ဆက်မြင်ရတယ်။
//    နေရာချမှုက CSS မှာ (index.html: #radialWrap) — ကျဉ်းရင် icon ချည်း၊
//    အလျားလိုက်ဆို ၂ ကော်လံ။
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

    // ── Dock items ───────────────────────────────────────────────────
    // ★ Arc မဟုတ်တော့ဘူး — --tx/--ty နဲ့ နေရာ တွက်စရာ မလိုတော့ဘူး။
    //   CSS grid က ဘေးအနားမှာ တန်းစီပေးတယ်၊ ကျဉ်းရင် icon ချည်း၊
    //   အလျားလိုက်ဆို ၂ ကော်လံ — အလယ်ကို ဘယ်တော့မှ မဝင်ဘူး။
    items.forEach((item) => {
      const el = document.createElement('button');
      el.className = 'radialItem';
      el.title = item.label;
      el.setAttribute('aria-label', item.label);
      el.innerHTML =
        `<span class="ri">${item.icon}</span><span class="rl">${item.label}</span>`;
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
