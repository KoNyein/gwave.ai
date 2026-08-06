// input/input.js — devices → actions (spec §7)
// Keyboard + touch joystick + gamepad all feed the same move axis, so game
// code never knows which device is attached.

/// Rebindable action map (spec §7) — stored per-browser; the Controls dialog
/// in the editor header writes here.
const DEFAULT_KEYS = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  run: "ShiftLeft",
  interact: "KeyE",
};

export function loadKeymap() {
  try {
    return { ...DEFAULT_KEYS, ...JSON.parse(localStorage.getItem("gwe:keys") || "{}") };
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function saveKeymap(map) {
  try {
    localStorage.setItem("gwe:keys", JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function createInput() {
  const keys = new Set();
  let km = loadKeymap();
  addEventListener("keydown", (e) => keys.add(e.code));
  addEventListener("keyup", (e) => keys.delete(e.code));

  const touch = { active: false, x: 0, y: 0 };
  const pad = document.getElementById("pad");
  const stick = document.getElementById("stick");
  if (pad && stick) {
    const move = (e) => {
      if (e.type === "pointermove" && e.buttons === 0) return;
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - r.left - r.width / 2;
      let dy = e.clientY - r.top - r.height / 2;
      const d = Math.hypot(dx, dy);
      const max = r.width * 0.37;
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      touch.x = dx / max;
      touch.y = dy / max;
      touch.active = true;
    };
    pad.addEventListener("pointerdown", move);
    pad.addEventListener("pointermove", move);
    const end = () => {
      touch.active = false;
      touch.x = touch.y = 0;
      stick.style.transform = "translate(0,0)";
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
  }
  let touchJump = false;
  const jb = document.getElementById("btn-jump");
  jb?.addEventListener("pointerdown", (e) => {
    touchJump = true;
    e.preventDefault();
  });
  jb?.addEventListener("pointerup", () => (touchJump = false));

  let gp = null;
  return {
    poll() {
      gp = navigator.getGamepads?.()[0] ?? null;
    },
    axis() {
      let x = (keys.has(km.right) ? 1 : 0) - (keys.has(km.left) ? 1 : 0);
      let z = (keys.has(km.back) ? 1 : 0) - (keys.has(km.forward) ? 1 : 0);
      if (touch.active) {
        x = touch.x;
        z = touch.y;
      }
      if (gp && Math.hypot(gp.axes[0] ?? 0, gp.axes[1] ?? 0) > 0.15) {
        x = gp.axes[0];
        z = gp.axes[1];
      }
      const m = Math.hypot(x, z);
      if (m > 1) {
        x /= m;
        z /= m;
      }
      return { x, z };
    },
    jump: () => keys.has(km.jump) || touchJump || !!gp?.buttons?.[0]?.pressed,
    run: () =>
      keys.has(km.run) || keys.has("ShiftRight") || !!gp?.buttons?.[5]?.pressed,
    interact: () => keys.has(km.interact) || !!gp?.buttons?.[2]?.pressed,
    key: (code) => keys.has(code),
    keymap: () => ({ ...km }),
    setKeymap(next) {
      km = { ...km, ...next };
      saveKeymap(km);
    },
  };
}
