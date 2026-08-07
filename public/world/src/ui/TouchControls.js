// ============================================================
// TouchControls.js — Mobile Touch ထိန်းချုပ်မှု
// ဘယ်ဘက် = Virtual Joystick (လမ်းလျှောက်, အပြည့်တွန်း = ပြေး)
// ညာဘက် မျက်နှာပြင် = ဆွဲ၍ ကြည့်ရှု (look)
// ခလုတ်များ = ခုန် / E (စကားပြော·Portal) / 🔫 ပစ်
// Touch device ဖြစ်မှသာ အလိုအလျောက် ပေါ်လာသည်
// ============================================================
export class TouchControls {
  constructor(input) {
    this.input = input;
    if (!('ontouchstart' in window)) return; // Desktop → မလို

    input.touchMode = true;
    input.touch = { f: 0, s: 0 }; // forward / side (analog -1..1)

    this.buildUI();
    this.bindJoystick();
    this.bindLook();
  }

  el(tag, css, parent, text = '') {
    const e = document.createElement(tag);
    e.style.cssText = css;
    e.textContent = text;
    (parent || document.body).appendChild(e);
    return e;
  }

  buildUI() {
    const btnCss = `position:fixed; width:64px; height:64px; border-radius:50%;
      background:rgba(10,16,34,.7); border:1px solid #2a3a66; color:#eaf0ff;
      font-size:22px; display:flex; align-items:center; justify-content:center;
      user-select:none; -webkit-user-select:none; touch-action:none; z-index:5;
      font-family:inherit;`;

    // Joystick (ဘယ်အောက်)
    this.base = this.el('div', `position:fixed; left:26px; bottom:96px; width:120px; height:120px;
      border-radius:50%; background:rgba(10,16,34,.5); border:1px solid #2a3a66;
      touch-action:none; z-index:5;`);
    this.knob = this.el('div', `position:absolute; left:38px; top:38px; width:44px; height:44px;
      border-radius:50%; background:rgba(245,197,66,.85);`, this.base);

    // ခလုတ်များ (ညာအောက်)
    this.jumpBtn = this.el('div', btnCss + 'right:26px; bottom:170px;', null, '⤒');
    this.eBtn    = this.el('div', btnCss + 'right:104px; bottom:110px;', null, 'E');
    this.fireBtn = this.el('div', btnCss + 'right:26px; bottom:90px; width:74px; height:74px; font-size:26px;', null, '🔫');

    const hold = (el, code) => {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this.input.keys.has(code)) this.input.pressedThisFrame.add(code);
        this.input.keys.add(code);
      }, { passive: false });
      el.addEventListener('touchend', () => this.input.keys.delete(code));
    };
    hold(this.jumpBtn, 'Space');
    hold(this.eBtn, 'KeyE');
    this.fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.clickedThisFrame = true;
      this.input.mouseDown = true;
    }, { passive: false });
    this.fireBtn.addEventListener('touchend', () => { this.input.mouseDown = false; });
  }

  bindJoystick() {
    const R = 44; // knob အလွန်ဆုံး အကွာအဝေး
    let touchId = null;
    const center = () => {
      const r = this.base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const move = (t) => {
      const c = center();
      let dx = t.clientX - c.x, dy = t.clientY - c.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.touch.s = dx / R;   // ဘယ်/ညာ
      this.input.touch.f = -dy / R;  // ရှေ့/နောက်
    };
    this.base.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchId = e.changedTouches[0].identifier;
      move(e.changedTouches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchId) move(t);
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchId) {
        touchId = null;
        this.knob.style.transform = '';
        this.input.touch.f = 0; this.input.touch.s = 0;
      }
    });
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
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    });
  }
}
