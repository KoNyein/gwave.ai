// ============================================================
// TouchControls.js — Mobile Touch ထိန်းချုပ်မှု
// ဘယ်ဘက် = Virtual Joystick (လမ်းလျှောက်, အပြည့်တွန်း = ပြေး)
// ညာဘက် မျက်နှာပြင် = ဆွဲ၍ ကြည့်ရှု (look)
// ခလုတ်များ = ခုန် / E (စကားပြော·Portal) / 🔫 ပစ်
// Touch device ဖြစ်မှသာ အလိုအလျောက် ပေါ်လာသည်
//
// 📐 Layout က **CSS ထဲမှာ** (index.html ရဲ့ .tcBtn / #tcStick …)。
//    အရင်က inline style နဲ့ px အသေ ချထားလို့:
//      · safe-area (notch / home indicator) ကို မလိုက်ဘူး
//      · ကျဉ်းတဲ့ဖုန်း/landscape မှာ ခလုတ်တွေ အချင်းချင်း ထပ်တယ်
//      · media query နဲ့ ပြင်လို့ မရဘူး
//    အခု class ချည်းပဲ — CSS က ဖုန်းအရွယ်အစားအလိုက် ချိန်ပေးတယ်။
// ============================================================
export class TouchControls {
  constructor(input) {
    this.input = input;
    if (!TouchControls.isTouch()) return; // Desktop → မလို

    // ★ body.touch — HUD တစ်ခုလုံး (menu, hint, panel, action bar) က ဒီ
    //   class ကို ကြည့်ပြီး mobile layout ကို ခေါ်တယ်။
    document.body.classList.add('touch');

    input.touchMode = true;
    input.touch = { f: 0, s: 0 }; // forward / side (analog -1..1)

    this.buildUI();
    this.bindJoystick();
    this.bindLook();
  }

  /// Touch စက်လား — `ontouchstart` တစ်ခုတည်းက Windows touch laptop တွေမှာ
  /// မှားတတ်လို့ pointer capability ကိုပါ စစ်တယ်။
  static isTouch() {
    return (
      'ontouchstart' in window &&
      window.matchMedia('(hover: none), (pointer: coarse)').matches
    );
  }

  el(tag, cls, parent, text = '') {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    (parent || document.body).appendChild(e);
    return e;
  }

  buildUI() {
    // Joystick (ဘယ်အောက်)
    this.base = this.el('div', '');
    this.base.id = 'tcStick';
    this.knob = this.el('div', '', this.base);
    this.knob.id = 'tcKnob';

    // ခလုတ်များ (ညာအောက်) — နေရာ/အရွယ်အစား CSS ကနေ
    this.jumpBtn = this.el('div', 'tcBtn', null, '⤒');
    this.jumpBtn.id = 'tcJump';
    this.eBtn = this.el('div', 'tcBtn', null, 'E');
    this.eBtn.id = 'tcE';
    this.fireBtn = this.el('div', 'tcBtn', null, '🔫');
    this.fireBtn.id = 'tcFire';

    for (const b of [this.jumpBtn, this.eBtn, this.fireBtn]) {
      b.setAttribute('role', 'button');
    }
    this.jumpBtn.setAttribute('aria-label', 'ခုန်');
    this.eBtn.setAttribute('aria-label', 'E — kiosk / NPC / Portal');
    this.fireBtn.setAttribute('aria-label', 'ပစ်');

    const hold = (el, code) => {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this.input.keys.has(code)) this.input.pressedThisFrame.add(code);
        this.input.keys.add(code);
      }, { passive: false });
      // ★ touchcancel ပါ ဖမ်းရမယ် — ဖုန်းက notification ဆွဲချလိုက်ရင်
      //   touchend မလာဘဲ ခလုတ်က "ဖိထားတုန်း" ဖြစ်နေတတ်တယ်။
      const release = () => this.input.keys.delete(code);
      el.addEventListener('touchend', release);
      el.addEventListener('touchcancel', release);
    };
    hold(this.jumpBtn, 'Space');
    hold(this.eBtn, 'KeyE');

    this.fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.clickedThisFrame = true;
      this.input.mouseDown = true;
    }, { passive: false });
    const stopFire = () => { this.input.mouseDown = false; };
    this.fireBtn.addEventListener('touchend', stopFire);
    this.fireBtn.addEventListener('touchcancel', stopFire);
  }

  bindJoystick() {
    let touchId = null;
    const center = () => {
      const r = this.base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    };
    const move = (t) => {
      const c = center();
      // ★ Knob ရဲ့ အလွန်ဆုံး အကွာအဝေးကို base ရဲ့ အရွယ်အစားကနေ တွက်တယ် —
      //   CSS က ဖုန်းအရွယ်အလိုက် stick ကို သေးစေလို့ px အသေ မထားနိုင်ဘူး။
      const R = c.r - 24;
      let dx = t.clientX - c.x, dy = t.clientY - c.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.touch.s = dx / R;   // ဘယ်/ညာ
      this.input.touch.f = -dy / R;  // ရှေ့/နောက်
    };
    const release = () => {
      touchId = null;
      this.knob.style.transform = '';
      this.input.touch.f = 0; this.input.touch.s = 0;
    };
    this.base.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchId = e.changedTouches[0].identifier;
      move(e.changedTouches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchId) move(t);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchId) release();
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  bindLook() {
    // ညာဘက် မျက်နှာပြင်တစ်ဝက် — ဆွဲ၍ ကြည့်ရှု (ခလုတ်များပေါ်မှ touch မပါ)
    let lookId = null, lastX = 0, lastY = 0;
    window.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.45 && t.target.tagName === 'CANVAS') {
          lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
        }
      }
    });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) {
        this.input.yaw   -= (t.clientX - lastX) * 0.006;
        this.input.pitch += (t.clientY - lastY) * 0.005;
        this.input.pitch = Math.max(-1.25, Math.min(1.25, this.input.pitch));
        lastX = t.clientX; lastY = t.clientY;
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }
}
