import type { Controls } from "./engine";

// Input sources for the sim. Touch (virtual sticks) is handled in the component;
// this module reads the Gamepad API (USB/Bluetooth gamepads AND radios put in
// USB-joystick mode — ELRS/Crossfire/FrSky/DJI radios all expose themselves as a
// standard HID joystick) and the keyboard (PC fallback).

export function zero(): Controls {
  return { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
}

const DEADZONE = 0.06;
function dz(v: number): number {
  return Math.abs(v) < DEADZONE ? 0 : v;
}

export interface GamepadRead {
  name: string;
  controls: Controls;
}

/**
 * Read the first connected gamepad/radio as Mode-2 FPV controls:
 * left stick = throttle (Y) + yaw (X), right stick = pitch (Y) + roll (X).
 * Returns null when nothing is connected.
 */
export function readGamepad(): GamepadRead | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const p of pads) {
    if (!p) continue;
    const a = p.axes;
    const yaw = dz(a[0] ?? 0);
    const throttleRaw = a[1] ?? 0; // stick up is -1
    const roll = dz(a[2] ?? 0);
    const pitchRaw = a[3] ?? 0; // stick up is -1 → nose down
    return {
      name: p.id.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Controller",
      controls: {
        throttle: Math.max(0, -throttleRaw), // up = climb
        yaw,
        roll,
        pitch: dz(pitchRaw), // forward (stick up, -1) → we want nose down = -pitch
      },
    };
  }
  return null;
}

/** Keyboard state → controls. WASD throttle/yaw, arrows pitch/roll. */
export class KeyboardInput {
  private down = new Set<string>();
  private handler = (e: KeyboardEvent, on: boolean) => {
    const k = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k)
    ) {
      e.preventDefault();
      if (on) this.down.add(k);
      else this.down.delete(k);
    }
  };
  private onDown = (e: KeyboardEvent) => this.handler(e, true);
  private onUp = (e: KeyboardEvent) => this.handler(e, false);

  attach(): void {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
  }
  detach(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    this.down.clear();
  }
  get active(): boolean {
    return this.down.size > 0;
  }
  read(): Controls {
    const d = this.down;
    return {
      throttle: d.has("w") ? 1 : d.has("s") ? 0 : 0.5,
      yaw: (d.has("d") ? 1 : 0) - (d.has("a") ? 1 : 0),
      pitch: (d.has("arrowup") ? -1 : 0) + (d.has("arrowdown") ? 1 : 0),
      roll: (d.has("arrowright") ? 1 : 0) - (d.has("arrowleft") ? 1 : 0),
    };
  }
}
