// ============================================================
// Input.js — Keyboard + Mouse (Pointer Lock + Click) ထိန်းချုပ်မှု
// yaw/pitch = Mouse ဖြင့် ကြည့်ရှုသည့် ထောင့်များ
// ============================================================
export class Input {
  constructor(domElement) {
    this.keys = new Set();
    this.yaw = 0;      // ဘယ်/ညာ လှည့်ထောင့်
    this.pitch = 0.25; // အပေါ်/အောက် ကြည့်ထောင့်
    this.pressedThisFrame = new Set(); // E လို တစ်ချက်နှိပ် key များ
    this.clickedThisFrame = false;     // ပစ်ခတ်ရန် (mouse click)
    this.mouseDown = false;
    this.domElement = domElement;

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Canvas ကိုနှိပ်လျှင် Pointer Lock (FPS/TPS games များ၏ စံနည်း)
    domElement.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== domElement) {
        domElement.requestPointerLock();
      } else if (e.button === 0) {
        this.mouseDown = true;
        this.clickedThisFrame = true;
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== domElement) return;
      this.yaw   -= e.movementX * 0.0025;
      this.pitch += e.movementY * 0.0022;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
    });
  }

  get locked() { return document.pointerLockElement === this.domElement; }
  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressedThisFrame.has(code); }
  justClicked() { return this.clickedThisFrame; }
  endFrame() { this.pressedThisFrame.clear(); this.clickedThisFrame = false; }
}
