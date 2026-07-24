"use client";

import * as React from "react";

import {
  type Controls,
  type DroneState,
  type FlightMode,
  type Track,
  type Vec3,
  initDrone,
  passedGate,
  render,
  speed,
  step,
  TRACKS,
} from "./engine";
import { KeyboardInput, readGamepad, zero } from "./input";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${s}.${cs.toString().padStart(2, "0")}s`;
}

export function DroneSim() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [trackIdx, setTrackIdx] = React.useState(0);
  const [mode, setMode] = React.useState<FlightMode>("angle");
  const [running, setRunning] = React.useState(false);

  // HUD (updated a few times/sec, not every frame).
  const [hud, setHud] = React.useState({
    gate: 0,
    total: TRACKS[0]!.gates.length,
    lap: 0,
    best: 0,
    spd: 0,
    thr: 0,
    source: "—",
    crashed: false,
  });

  // Mutable sim + input state (refs so the RAF loop doesn't re-render).
  const drone = React.useRef<DroneState>(initDrone(TRACKS[0]!));
  const nextGate = React.useRef(0);
  const startAt = React.useRef(0);
  const best = React.useRef(0);
  const kb = React.useRef(new KeyboardInput());
  const touchThr = React.useRef(0);
  const touchL = React.useRef<{ yaw: number } | null>(null);
  const touchR = React.useRef<{ roll: number; pitch: number } | null>(null);
  const runningRef = React.useRef(false);
  const modeRef = React.useRef<FlightMode>("angle");
  const trackRef = React.useRef<Track>(TRACKS[0]!);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Load best for the selected track.
  React.useEffect(() => {
    trackRef.current = TRACKS[trackIdx]!;
    const b = Number(
      localStorage.getItem(`gw_drone_best_${trackIdx}`) ?? "0",
    );
    best.current = b;
    reset();
    setHud((h) => ({ ...h, total: TRACKS[trackIdx]!.gates.length, best: b }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIdx]);

  function reset() {
    drone.current = initDrone(trackRef.current);
    nextGate.current = 0;
    startAt.current = 0;
    touchThr.current = 0;
  }

  function currentControls(): { c: Controls; source: string } {
    // Priority: touch → gamepad → keyboard.
    if (touchL.current || touchR.current || touchThr.current > 0) {
      return {
        c: {
          throttle: touchThr.current,
          yaw: touchL.current?.yaw ?? 0,
          roll: touchR.current?.roll ?? 0,
          pitch: touchR.current?.pitch ?? 0,
        },
        source: "Touch",
      };
    }
    const gp = readGamepad();
    if (gp) return { c: gp.controls, source: gp.name };
    if (kb.current.active) return { c: kb.current.read(), source: "Keyboard" };
    return { c: zero(), source: "—" };
  }

  // Main loop.
  React.useEffect(() => {
    kb.current.attach();
    const kbRef = kb.current;
    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;

      const track = trackRef.current;
      const { c, source } = currentControls();

      if (runningRef.current && !drone.current.crashed) {
        if (startAt.current === 0 && c.throttle > 0.05) {
          startAt.current = now;
        }
        const prev: Vec3 = { ...drone.current.pos };
        step(drone.current, c, modeRef.current, dt);
        const g = track.gates[nextGate.current];
        if (g && passedGate(drone.current, prev, g)) {
          nextGate.current += 1;
          if (nextGate.current >= track.gates.length) {
            const lap = now - startAt.current;
            finishLap(lap);
          }
        }
      }

      render(ctx, w, h, drone.current, track, nextGate.current);

      hudAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        const lap =
          runningRef.current && startAt.current > 0
            ? now - startAt.current
            : 0;
        setHud({
          gate: nextGate.current,
          total: track.gates.length,
          lap,
          best: best.current,
          spd: speed(drone.current),
          thr: c.throttle,
          source,
          crashed: drone.current.crashed,
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      kbRef.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishLap(ms: number) {
    runningRef.current = false;
    setRunning(false);
    if (best.current === 0 || ms < best.current) {
      best.current = ms;
      localStorage.setItem(`gw_drone_best_${trackIdx}`, String(Math.round(ms)));
    }
    // Submit to the Champions League leaderboard (best-effort).
    void fetch("/api/games/drone/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ track: trackRef.current.name, ms: Math.round(ms) }),
    }).catch(() => {});
  }

  function start() {
    reset();
    runningRef.current = true;
    setRunning(true);
  }

  // Keep canvas sized to its box.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(320, Math.floor(r.width));
      canvas.height = Math.max(240, Math.floor(r.height));
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // --- Touch joysticks ---
  function leftPad(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height; // 0..1
    touchThr.current = Math.min(1, Math.max(0, 1 - y));
    touchL.current = { yaw: Math.min(1, Math.max(-1, x * 2 - 1)) };
  }
  function rightPad(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    touchR.current = {
      roll: Math.min(1, Math.max(-1, x * 2 - 1)),
      pitch: Math.min(1, Math.max(-1, y * 2 - 1)),
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={trackIdx}
          onChange={(e) => setTrackIdx(Number(e.target.value))}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {TRACKS.map((t, i) => (
            <option key={t.name} value={i}>
              🏁 {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setMode((m) => (m === "angle" ? "acro" : "angle"))}
          className="rounded-md border px-2 py-1 text-sm font-medium"
        >
          Mode: {mode === "angle" ? "Angle (easy)" : "Acro (pro)"}
        </button>
        <button
          onClick={start}
          className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground"
        >
          {running ? "Restart" : "Start"}
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          🎮 {hud.source}
        </span>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0 p-3 font-mono text-[13px] text-white">
          <div className="flex justify-between">
            <span className="rounded bg-black/40 px-2 py-0.5">
              Gate {Math.min(hud.gate + 1, hud.total)}/{hud.total}
            </span>
            <span className="rounded bg-black/40 px-2 py-0.5">
              ⏱ {fmt(hud.lap)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="rounded bg-black/40 px-2 py-0.5">
              {hud.spd.toFixed(0)} m/s
            </span>
            <span className="rounded bg-black/40 px-2 py-0.5">
              Best {hud.best ? fmt(hud.best) : "—"}
            </span>
          </div>
          {hud.crashed ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-red-600/90 px-4 py-2 text-lg font-bold">
                💥 Crashed — press Start
              </span>
            </div>
          ) : null}
          {!running && !hud.crashed ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-black/60 px-4 py-2 text-center text-sm">
                Press <b>Start</b>, then throttle up.<br />
                Touch: left = throttle/yaw · right = pitch/roll
              </span>
            </div>
          ) : null}
        </div>

        {/* Touch sticks (mobile) */}
        <div
          className="absolute bottom-0 left-0 top-1/3 w-1/3 touch-none md:hidden"
          onPointerDown={leftPad}
          onPointerMove={leftPad}
          onPointerUp={() => {
            touchL.current = null;
          }}
          onPointerCancel={() => {
            touchL.current = null;
          }}
        >
          <div className="absolute inset-3 rounded-2xl border border-white/20 bg-white/5" />
        </div>
        <div
          className="absolute bottom-0 right-0 top-1/3 w-1/3 touch-none md:hidden"
          onPointerDown={rightPad}
          onPointerMove={rightPad}
          onPointerUp={() => {
            touchR.current = null;
          }}
          onPointerCancel={() => {
            touchR.current = null;
          }}
        >
          <div className="absolute inset-3 rounded-2xl border border-white/20 bg-white/5" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Fly with a phone (touch sticks), a keyboard (W/S throttle, A/D yaw, arrows
        pitch/roll), or a controller. A USB/Bluetooth gamepad — or an ELRS /
        Crossfire / FrSky / DJI radio in <b>USB-joystick mode</b> — is read
        through the browser Gamepad API, exactly like Liftoff / DRL Sim.
      </p>
    </div>
  );
}
