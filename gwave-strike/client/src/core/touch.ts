import type { Input } from "./input";

/// Touch controls (blueprint §6): left virtual joystick = move, right
/// half-screen drag = aim, buttons for fire / ADS / jump / reload.
/// DOM-based (no nipplejs dep) — same pattern the metaverse HUD proved on
/// low-end Android.

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && navigator.maxTouchPoints > 0;
}

export function attachTouchControls(parent: HTMLElement, input: Input): void {
  const ui = document.createElement("div");
  ui.style.cssText =
    "position:absolute;inset:0;pointer-events:none;user-select:none;-webkit-user-select:none";
  parent.appendChild(ui);

  const btn = (label: string, css: string) => {
    const b = document.createElement("div");
    b.textContent = label;
    b.style.cssText =
      "position:absolute;pointer-events:auto;display:flex;align-items:center;justify-content:center;" +
      "border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff;" +
      "border-radius:50%;backdrop-filter:blur(2px);touch-action:none;font-size:13px;" +
      css;
    ui.appendChild(b);
    return b;
  };

  // ── Left joystick ──
  const stick = btn("", "left:18px;bottom:18px;width:112px;height:112px;border-radius:50%");
  const knob = document.createElement("div");
  knob.style.cssText =
    "width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.3);pointer-events:none";
  stick.appendChild(knob);
  let stickId = -1;
  const stickCenter = { x: 0, y: 0 };
  stick.addEventListener("pointerdown", (e) => {
    stickId = e.pointerId;
    const r = stick.getBoundingClientRect();
    stickCenter.x = r.left + r.width / 2;
    stickCenter.y = r.top + r.height / 2;
    stick.setPointerCapture(e.pointerId);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickId) return;
    const dx = (e.clientX - stickCenter.x) / 48;
    const dy = (e.clientY - stickCenter.y) / 48;
    const l = Math.hypot(dx, dy);
    const cx = l > 1 ? dx / l : dx;
    const cy = l > 1 ? dy / l : dy;
    input.state.s = cx;
    input.state.f = -cy;
    input.state.run = l > 0.85;
    knob.style.transform = `translate(${cx * 33}px, ${cy * 33}px)`;
  });
  const stickEnd = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = -1;
    input.state.f = 0;
    input.state.s = 0;
    input.state.run = false;
    knob.style.transform = "";
  };
  stick.addEventListener("pointerup", stickEnd);
  stick.addEventListener("pointercancel", stickEnd);

  // ── Right half-screen aim drag ──
  const aim = document.createElement("div");
  aim.style.cssText =
    "position:absolute;top:0;right:0;bottom:0;width:55%;pointer-events:auto;touch-action:none";
  ui.appendChild(aim);
  let aimId = -1;
  let lastX = 0;
  let lastY = 0;
  aim.addEventListener("pointerdown", (e) => {
    if (aimId !== -1) return;
    aimId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    aim.setPointerCapture(e.pointerId);
  });
  aim.addEventListener("pointermove", (e) => {
    if (e.pointerId !== aimId) return;
    input.state.yaw -= (e.clientX - lastX) * 0.005;
    input.state.pitch -= (e.clientY - lastY) * 0.005;
    const lim = Math.PI / 2 - 0.02;
    input.state.pitch = Math.max(-lim, Math.min(lim, input.state.pitch));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const aimEnd = (e: PointerEvent) => {
    if (e.pointerId === aimId) aimId = -1;
  };
  aim.addEventListener("pointerup", aimEnd);
  aim.addEventListener("pointercancel", aimEnd);

  // ── Buttons (above the aim zone so they still get events) ──
  const hold = (el: HTMLElement, set: (v: boolean) => void) => {
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      set(true);
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"] as const) {
      el.addEventListener(ev, () => set(false));
    }
  };
  const fire = btn("🔫", "right:24px;bottom:70px;width:84px;height:84px;font-size:30px;z-index:2");
  hold(fire, (v) => (input.state.fire = v));
  const ads = btn("🎯", "right:126px;bottom:150px;width:58px;height:58px;font-size:22px;z-index:2");
  hold(ads, (v) => (input.state.ads = v));
  const jump = btn("⬆", "right:130px;bottom:26px;width:58px;height:58px;font-size:22px;z-index:2");
  hold(jump, (v) => (input.state.jump = v));
  const reload = btn("🔄", "right:34px;bottom:170px;width:52px;height:52px;font-size:20px;z-index:2");
  hold(reload, (v) => (input.state.reload = v));
}
