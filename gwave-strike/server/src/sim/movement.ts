import { MAP_HALF, MOVE, terrainHeight } from "@gwave-strike/shared";

import type { PlayerState } from "../schema/State.js";

/// Authoritative movement (blueprint §4.1). The server never trusts client
/// positions — it integrates the client's INPUTS with the same shared
/// constants the client predicts with, clamps dt (speed-hack ceiling), and
/// grounds on the shared terrain function. Crates are client-side feel only;
/// the speed clamp bounds any divergence a cheater could exploit.

export type PlayerInput = {
  seq: number;
  dt: number;
  f: number;
  s: number;
  run: boolean;
  crouch: boolean;
  yaw: number;
  pitch: number;
};

export function applyInput(p: PlayerState, inp: PlayerInput) {
  const dt = Math.min(0.05, Math.max(0, inp.dt));
  const f = Math.max(-1, Math.min(1, inp.f));
  const s = Math.max(-1, Math.min(1, inp.s));

  let speed = inp.run && f > 0 ? MOVE.run : MOVE.walk;
  if (inp.crouch) speed *= MOVE.crouchScale;

  const sin = Math.sin(inp.yaw);
  const cos = Math.cos(inp.yaw);
  const wx = -sin * f + cos * s;
  const wz = -cos * f - sin * s;
  const len = Math.hypot(wx, wz) || 1;

  p.x = Math.max(-MAP_HALF + 1, Math.min(MAP_HALF - 1, p.x + (wx / len) * speed * dt));
  p.z = Math.max(-MAP_HALF + 1, Math.min(MAP_HALF - 1, p.z + (wz / len) * speed * dt));
  p.y = terrainHeight(p.x, p.z);
  p.yaw = inp.yaw;
  p.pitch = Math.max(-1.55, Math.min(1.55, inp.pitch));
  p.lastSeq = inp.seq >>> 0;
  p.anim =
    Math.hypot(wx, wz) < 0.01
      ? "idle"
      : speed > MOVE.walk + 0.5
        ? "run"
        : "walk";
}

/// 1-second position history ring buffer for lag compensation (§4.1):
/// hit validation rewinds targets to the shooter's timestamp.
export class History {
  private buf: { t: number; x: number; y: number; z: number }[] = [];

  push(t: number, x: number, y: number, z: number) {
    this.buf.push({ t, x, y, z });
    const cutoff = t - 1000;
    while (this.buf.length > 0 && this.buf[0]!.t < cutoff) this.buf.shift();
  }

  at(t: number): { x: number; y: number; z: number } | null {
    if (this.buf.length === 0) return null;
    let best = this.buf[0]!;
    for (const e of this.buf) {
      if (Math.abs(e.t - t) < Math.abs(best.t - t)) best = e;
    }
    return best;
  }
}
