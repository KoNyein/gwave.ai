/// FPV input — keyboard / touch dual-stick / USB-BT controller (Gamepad API)။
///
/// ★ RadioMaster / Jumper / BetaFPV စတဲ့ radio တွေက USB (joystick mode)
///   ဒါမှမဟုတ် Bluetooth နဲ့ ချိတ်ရင် browser မှာ **Gamepad** အဖြစ် ပေါ်တယ်
///   — driver မလိုဘူး။ Axis order က radio တစ်မျိုးစီ မတူလို့ mapping ကို
///   ပြင်လို့ရပြီး localStorage မှာ မှတ်ထားတယ်။
/// ★ ဦးစားပေးအစဉ်: controller ချိတ်ထား + လှုပ်နေရင် controller၊ မဟုတ်ရင်
///   touch / keyboard — device မခွဲဘဲ အကုန် နားထောင်ထားတယ် (PC/iPad/
///   Android/iOS အားလုံး အလုပ်လုပ်စေဖို့)။

import {
  DEFAULT_MAP,
  NEUTRAL_CAL,
  normalize,
  normalizeThrottle,
  type AxisCal,
  type AxisMap,
} from "./calibration";
import type { Sticks } from "./physics";

export { DEFAULT_MAP };
export type { AxisMap };

const MAP_KEY = "gw-fpv-axismap";

export function loadAxisMap(): AxisMap {
  try {
    const raw = window.localStorage.getItem(MAP_KEY);
    if (raw) return { ...DEFAULT_MAP, ...(JSON.parse(raw) as Partial<AxisMap>) };
  } catch {
    // localStorage မရလည်း default နဲ့ ဆက်သွား
  }
  return { ...DEFAULT_MAP };
}

export function saveAxisMap(map: AxisMap) {
  try {
    window.localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}


export type FpvInput = {
  read(dt: number): Sticks;
  /// controller တစ်လုံး ချိတ်ထားလား (UI ပြဖို့)
  gamepadName(): string | null;
  /// ★ Raw, uncalibrated axes — the calibration wizard has to see what the
  ///   hardware actually sends, not the mapped-and-normalised result it is
  ///   trying to produce.
  rawAxes(): readonly number[] | null;
  /// arm/disarm + respawn ခလုတ်တွေ (keyboard R / gamepad button)
  consumeArmToggle(): boolean;
  consumeRespawn(): boolean;
  /// UI ခလုတ်ကနေ queue ထဲ တိုက်ရိုက်ထည့်ဖို့ (keyboard နဲ့ လမ်းကြောင်းတူ)
  queueArm(): void;
  queueRespawn(): void;
  /// Touch stick တွေရဲ့ တန်ဖိုး (virtual stick UI ဆွဲပြဖို့)
  touchState(): { lx: number; ly: number; rx: number; ry: number };
  setTouchLeft(x: number, y: number): void;
  setTouchRight(x: number, y: number): void;
  dispose(): void;
};

export function createInput(map: AxisMap): FpvInput {
  // ── Keyboard ────────────────────────────────────────────────────────
  // W/S = throttle, A/D = yaw, Arrows = pitch/roll (Liftoff keyboard layout
  // နဲ့ ဆင်တူ)။ Keyboard က on/off မို့ smoothing နဲ့ stick တု ဖန်တီးတယ်။
  const keys = new Set<string>();
  let armQueued = false;
  let respawnQueued = false;
  const kd = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    keys.add(e.code);
    if (e.code === "Space") {
      armQueued = true;
      e.preventDefault();
    }
    if (e.code === "KeyR") respawnQueued = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  };
  const ku = (e: KeyboardEvent) => keys.delete(e.code);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);

  // Keyboard smoothing state
  const kb: Sticks = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };

  // ── Touch dual-stick (fpv-sim.tsx က DOM stick တွေကနေ တန်ဖိုးထည့်တယ်) ──
  const touch = { lx: 0, ly: 0, rx: 0, ry: 0, active: false };

  // ── Gamepad ─────────────────────────────────────────────────────────
  let padIndex: number | null = null;
  let lastPadButton = false;
  let lastPadRespawn = false;
  const onConnect = (e: GamepadEvent) => {
    padIndex = e.gamepad.index;
  };
  const onDisconnect = (e: GamepadEvent) => {
    if (padIndex === e.gamepad.index) padIndex = null;
  };
  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onDisconnect);

  const pad = (): Gamepad | null => {
    // iOS Safari မှာ connected event မလာလည်း getGamepads ကနေ တွေ့တတ်တယ်
    const pads = navigator.getGamepads?.() ?? [];
    if (padIndex !== null && pads[padIndex]) return pads[padIndex] ?? null;
    for (const g of pads) if (g && g.axes.length >= 4) return g;
    return null;
  };

  /// ★ Calibration is applied here, not in the physics. Measured endpoints,
  ///   resting centre and per-axis deadband all belong to the hardware, and
  ///   the flight model should never see anything but a clean −1..1.
  ///   Uncalibrated radios fall back to the ideal ±1 range, which is what the
  ///   simulator assumed before the wizard existed.
  const calOf = (fn: "roll" | "pitch" | "throttle" | "yaw"): AxisCal =>
    map.cal?.[fn] ?? NEUTRAL_CAL;

  const readPad = (g: Gamepad): Sticks => {
    const ax = (i: number) => g.axes[i] ?? 0;
    const sign = (v: number, inv: boolean) => (inv ? -v : v);
    return {
      throttle: normalizeThrottle(ax(map.throttle), calOf("throttle"), map.invThrottle),
      roll: sign(normalize(ax(map.roll), calOf("roll")), map.invRoll),
      pitch: sign(normalize(ax(map.pitch), calOf("pitch")), map.invPitch),
      yaw: sign(normalize(ax(map.yaw), calOf("yaw")), map.invYaw),
    };
  };

  return {
    read(dt: number): Sticks {
      // 1) Controller — axis တစ်ခုခု လှုပ်နေရင် အနိုင်ယူတယ်
      const g = pad();
      if (g) {
        // Gamepad button 0/1 → arm, button 2/3 → respawn
        const b0 = Boolean(g.buttons[0]?.pressed || g.buttons[1]?.pressed);
        if (b0 && !lastPadButton) armQueued = true;
        lastPadButton = b0;
        const b2 = Boolean(g.buttons[2]?.pressed || g.buttons[3]?.pressed);
        if (b2 && !lastPadRespawn) respawnQueued = true;
        lastPadRespawn = b2;

        const s = readPad(g);
        const moving =
          s.throttle > 0.02 || Math.abs(s.roll) > 0.02 || Math.abs(s.pitch) > 0.02 || Math.abs(s.yaw) > 0.02;
        if (moving || !touch.active) return s;
      }

      // 2) Touch sticks
      if (touch.active) {
        // A small deadband on touch too — a thumb resting on the stick pad
        // is never exactly centred.
        const t = (v: number) => (Math.abs(v) < 0.04 ? 0 : v);
        return {
          throttle: Math.max(0, Math.min(1, (-touch.ly + 1) / 2)),
          yaw: t(touch.lx),
          roll: t(touch.rx),
          pitch: t(-touch.ry),
        };
      }

      // 3) Keyboard — smoothing နဲ့ stick တု
      const step = (cur: number, want: number, rate: number) =>
        cur + (want - cur) * Math.min(1, rate * dt);
      const w = (a: string, b: string) => (keys.has(a) ? 1 : 0) - (keys.has(b) ? 1 : 0);
      kb.throttle = step(kb.throttle, keys.has("KeyW") ? 1 : keys.has("KeyS") ? 0 : kb.throttle, 3.5);
      kb.yaw = step(kb.yaw, w("KeyD", "KeyA"), 8);
      kb.pitch = step(kb.pitch, w("ArrowUp", "ArrowDown"), 8);
      kb.roll = step(kb.roll, w("ArrowRight", "ArrowLeft"), 8);
      return { throttle: kb.throttle, roll: kb.roll, pitch: kb.pitch, yaw: kb.yaw };
    },
    gamepadName() {
      return pad()?.id ?? null;
    },
    rawAxes() {
      const g = pad();
      return g ? g.axes : null;
    },
    consumeArmToggle() {
      const v = armQueued;
      armQueued = false;
      return v;
    },
    consumeRespawn() {
      const v = respawnQueued;
      respawnQueued = false;
      return v;
    },
    queueArm() {
      armQueued = true;
    },
    queueRespawn() {
      respawnQueued = true;
    },
    touchState() {
      return { lx: touch.lx, ly: touch.ly, rx: touch.rx, ry: touch.ry };
    },
    setTouchLeft(x, y) {
      touch.lx = x;
      touch.ly = y;
      touch.active = true;
    },
    setTouchRight(x, y) {
      touch.rx = x;
      touch.ry = y;
      touch.active = true;
    },
    dispose() {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    },
  };
}
