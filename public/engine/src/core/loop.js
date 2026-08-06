// core/loop.js — fixed-timestep simulation + variable-rate render (spec §2)
// Physics/logic tick at 60Hz regardless of the screen; render every frame with
// an interpolation factor so 60Hz physics looks smooth on 144Hz screens.

export const FIXED_DT = 1 / 60;

export function startLoop({ poll, fixed, update, render }) {
  let acc = 0;
  let last = performance.now();
  let running = true;

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.25); // tab-switch clamp
    last = now;
    acc += dt;
    poll?.();
    while (acc >= FIXED_DT) {
      fixed(FIXED_DT);
      acc -= FIXED_DT;
    }
    const alpha = acc / FIXED_DT;
    update?.(dt, alpha);
    render(alpha);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
    },
  };
}
