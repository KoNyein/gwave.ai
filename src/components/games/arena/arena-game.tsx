"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { ARENA, pickSpawns, zoneAt } from "@/lib/arena/map";
import {
  createInterpolator,
  createPredictor,
  INTERP_DELAY_MS,
} from "@/lib/arena/net";

import { connectArena, type ArenaClient, type ArenaState } from "./net";
import { BrandedLoading } from "@/components/metaverse/branded-loading";
import { createArenaScene, type SceneHandle } from "./scene";

/// ဝှက်တမ်း — ကစားစခန်း。
///
/// ★ တာဝန်ခွဲဝေမှု —
///   · `scene.ts`      — three.js သီးသန့် (React မသိ)
///   · `net.ts`        — WebSocket သီးသန့်
///   · `lib/arena/net` — prediction/interpolation (browser မလို၊ test ရတယ်)
///   · ဒီ file         — အဲဒါ ၃ ခုကို ချိတ်ပြီး HUD ပြတာ
///   ဒီခွဲထားမှုက အရေးကြီးတယ်: netcode ကို test လုပ်လို့ရဖို့နဲ့၊ scene ကို
///   ပြင်တဲ့အခါ netcode မထိမိဖို့။

const WS_URL = process.env.NEXT_PUBLIC_MV_WS_URL || "";

function wsCandidates(): string[] {
  const out: string[] = [];
  if (WS_URL) out.push(WS_URL);
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const sameOrigin = `wss://${window.location.host}/mv/ws`;
    if (!out.includes(sameOrigin)) out.push(sameOrigin);
  }
  return out;
}

const PLAYER_RADIUS = 0.4;
/// ★ ဖမ်းနိုင်တဲ့ အကွာအဝေး — server ရဲ့ `TAG_RANGE` နဲ့ တူရမယ်။
///   ဒီမှာက ခလုတ်ကို ဘယ်အချိန် ဖွင့်ရမလဲ ဆုံးဖြတ်ဖို့သာ — တကယ့်
///   ဆုံးဖြတ်ချက်က server မှာ။ နည်းနည်း ကျယ်ထားတယ် (ping အတွက်)。
const TAG_UI_RANGE = 2.6;

type Role = "player" | "spectator";

export default function ArenaGame({ room = "hide-1" }: { room?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("ချိတ်ဆက်နေသည်…");
  const [state, setState] = useState<ArenaState>({ state: "waiting" });
  const [role, setRole] = useState<Role>("player");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [seekerId, setSeekerId] = useState<string | null>(null);
  const [zone, setZone] = useState<string>("");
  const [tagTarget, setTagTarget] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [denied, setDenied] = useState<string | null>(null);

  /// ★ Render loop ထဲက တန်ဖိုးတွေကို ref မှာ ထားတယ် — state မှာ ထားရင်
  ///   frame တိုင်း re-render ဖြစ်ပြီး scene တစ်ခုလုံး ပြန်ဆောက်မယ်။
  const seekerRef = useRef<string | null>(null);
  const selfRef = useRef<string | null>(null);
  const tagRef = useRef<string | null>(null);
  const zoneRef = useRef("");
  const netRef = useRef<ArenaClient | null>(null);

  const sendTag = useCallback(() => {
    const target = tagRef.current;
    if (!target) return;
    netRef.current?.sendAction({ type: "tag", targetId: target });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: SceneHandle | null = null;
    try {
      handle = createArenaScene(canvas, ARENA);
    } catch {
      setStatus("ဤစက်တွင် 3D မပံ့ပိုးပါ");
      return;
    }
    const scene = handle;

    // ── စတင်နေရာ ─────────────────────────────────────────────────────
    const spawn = pickSpawns(ARENA, 1, Math.floor(Math.random() * 100000))[0]!;
    const predictor = createPredictor({ x: spawn.x, z: spawn.z });
    const interp = createInterpolator();
    let yaw = Math.atan2(-spawn.x, -spawn.z); // ကွင်းလယ်ကို မျက်နှာမူ

    // ── ထည့်သွင်းမှု ──────────────────────────────────────────────────
    const keys = new Set<string>();
    const stick = { x: 0, y: 0, active: false, id: -1 };
    let look = { x: 0, active: false, id: -1 };

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === "e") sendTag();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ★ ဖုန်းအတွက် — ဘယ်ခြမ်း = ရွေ့လျားမှု, ညာခြမ်း = လှည့်ကြည့်ခြင်း。
    //   ခလုတ်တွေ ဆွဲထားစရာမလိုဘဲ ဖန်သားပြင် တစ်ဝက်စီ သုံးတာက
    //   လက်မနဲ့ ရောက်လွယ်ဆုံး (spec 4.2 လက်မဇုန်)。
    const onTouchStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth / 2 && !stick.active) {
          stick.active = true;
          stick.id = t.identifier;
          stick.x = t.clientX;
          stick.y = t.clientY;
        } else if (!look.active) {
          look = { x: t.clientX, active: true, id: t.identifier };
        }
      }
    };
    const move = { x: 0, z: 0 };
    const onTouchMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stick.id) {
          const dx = t.clientX - stick.x;
          const dy = t.clientY - stick.y;
          const len = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, len / 60) / len;
          move.x = dx * k;
          move.z = dy * k;
        } else if (t.identifier === look.id) {
          yaw -= (t.clientX - look.x) * 0.006;
          look.x = t.clientX;
        }
      }
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stick.id) {
          stick.active = false;
          stick.id = -1;
          move.x = 0;
          move.z = 0;
        }
        if (t.identifier === look.id) look = { x: 0, active: false, id: -1 };
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // ── ကွန်ရက် ──────────────────────────────────────────────────────
    const net = connectArena(wsCandidates(), room, {
      onStatus: (connected, detail) =>
        setStatus(connected ? "ချိတ်ဆက်ပြီး" : (detail ?? "ပြန်ချိတ်နေသည်…")),
      onSelf: (id) => {
        selfRef.current = id;
        setSelfId(id);
      },
      onJoined: ({ role: r }) => setRole(r),
      onDenied: (reason, until) =>
        setDenied(
          reason === "penalty"
            ? `ပွဲအလယ် ထွက်သွားလို့ ${Math.ceil(((until ?? 0) - Date.now()) / 60000)} မိနစ် စောင့်ရမယ်`
            : "ဝင်လို့ မရပါ",
        ),
      onState: (s) => {
        setState(s);
        if (s.modeState?.seekerId !== undefined) {
          seekerRef.current = s.modeState.seekerId ?? null;
          setSeekerId(s.modeState.seekerId ?? null);
        }
        // ★ ပွဲအသစ် စတိုင်း spawn ပြန်ချတယ် — မဟုတ်ရင် ရှာဖွေသူက
        //   ပွဲပြီးခါစက နေရာမှာပဲ ကျန်နေပြီး ဘေးက လူကို ချက်ချင်း ဖမ်းမိမယ်။
        if (s.state === "live") {
          const fresh = pickSpawns(ARENA, 1, Math.floor(Math.random() * 100000))[0]!;
          predictor.reset({ x: fresh.x, z: fresh.z });
        }
      },
      onEvent: (e) => {
        if (e.kind === "role" && e.id) {
          seekerRef.current = e.id;
          setSeekerId(e.id);
        }
      },
      onLeft: (ids) => {
        for (const id of ids) {
          interp.remove(id);
          scene.removeActor(id);
        }
      },
      onCorrect: (x, _y, z) => predictor.reset({ x, z }),
      onSnapshot: ({ t, ackSeq, players, gone }) => {
        const me = selfRef.current;
        for (const p of players) {
          if (p.id === me) {
            predictor.reconcile({ x: p.x, z: p.z }, ackSeq);
            continue;
          }
          interp.push(p.id, { t, x: p.x, y: p.y, z: p.z, ry: p.ry });
        }
        for (const id of gone ?? []) {
          interp.remove(id);
          scene.removeActor(id);
        }
      },
    });
    netRef.current = net;

    // ── Render loop ──────────────────────────────────────────────────
    let raf = 0;
    let last = performance.now();
    /// ★ Server နာရီနဲ့ client နာရီ ကွာချက် — interpolation က server
    ///   timestamp ကို သုံးလို့ ညှိရမယ်။
    let clockOffset = 0;
    let offsetSeen = false;

    const tmp = new THREE.Vector2();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // ── ရွေ့လျားမှု ─────────────────────────────────────────────
      // ★ WASD = ရွေ့လျား, မြှားခလုတ် = လှည့်ကြည့်。 E က ဖမ်းတာမို့
      //   လှည့်ဖို့ မသုံးဘူး — ခလုတ်တစ်ခုက အလုပ် ၂ ခု လုပ်ရင် ဖမ်းချင်တိုင်း
      //   လှည့်သွားမယ်။
      let mx = move.x;
      let mz = move.z;
      if (keys.has("w")) mz -= 1;
      if (keys.has("s")) mz += 1;
      if (keys.has("a")) mx -= 1;
      if (keys.has("d")) mx += 1;
      if (keys.has("arrowleft")) yaw += 1.8 * dt;
      if (keys.has("arrowright")) yaw -= 1.8 * dt;

      // ★ ထည့်သွင်းမှုက ကင်မရာနှင့် ဆက်စပ် — "ရှေ့" ဆိုတာ မြင်နေတဲ့ဘက်
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;

      const run = keys.has("shift") || Math.hypot(move.x, move.z) > 0.85;
      const before = predictor.position;
      const cmd = predictor.apply(wx, wz, dt, run);
      // ★ တိုက်မိမှုကို client မှာ တွက်တယ် — server က နေရာကို ဒီအတိုင်း
      //   လက်ခံပြီး speed cap ပဲ စစ်တယ်။ နံရံဖောက်ရင် ရွေ့လျားမှု
      //   ကန့်သတ်ချက်ကို မကျော်လို့ server က မဖမ်းဘူး — ဒါပေမယ့်
      //   ဝှက်တမ်းမှာ နံရံဖောက်တာက အနိုင်ရတဲ့ နည်းလမ်း မဟုတ်ဘူး
      //   (ပုန်းဖို့ပဲ)。 Combat mode ရောက်ရင် server-side collision လိုမယ်။
      const after = predictor.position;
      if (after.x !== before.x || after.z !== before.z) {
        tmp.set(after.x, after.z);
        const fixed = scene.collide(tmp, PLAYER_RADIUS);
        if (fixed.x !== after.x || fixed.y !== after.z) {
          predictor.reset({ x: fixed.x, z: fixed.y });
        }
      }
      const pos = predictor.position;

      net.sendUpdate(pos.x, 0, pos.z, yaw);
      net.sendInput(cmd.seq);

      // ── ကိုယ့်ရုပ် ─────────────────────────────────────────────
      const me = selfRef.current;
      if (me) {
        const g = scene.actor(me);
        g.position.set(pos.x, 0, pos.z);
        g.rotation.y = yaw;
        scene.setRole(me, seekerRef.current === me);
      }

      // ── တခြားသူများ ───────────────────────────────────────────
      const renderNow = now + clockOffset;
      let nearest: { id: string; d: number } | null = null;
      for (const id of interp.ids()) {
        const s = interp.sample(id, renderNow);
        if (!s) continue;
        const g = scene.actor(id);
        g.position.set(s.x, 0, s.z);
        g.rotation.y = s.ry;
        scene.setRole(id, seekerRef.current === id);
        const d = Math.hypot(s.x - pos.x, s.z - pos.z);
        if (!nearest || d < nearest.d) nearest = { id, d };
      }

      // ★ ဖမ်းခလုတ် — ရှာဖွေသူဖြစ်ပြီး ကပ်နေမှ ပေါ်တယ်။ အမြဲပြရင်
      //   ဖန်သားပြင် ကျဉ်းတဲ့ ဖုန်းမှာ နေရာ အလကားယူတယ်။
      const iAmSeeker = seekerRef.current === me;
      const target = iAmSeeker && nearest && nearest.d <= TAG_UI_RANGE ? nearest.id : null;
      if (target !== tagRef.current) {
        tagRef.current = target;
        setTagTarget(target);
      }

      // ── ကင်မရာ — ကျောပြင် ────────────────────────────────────
      // ★ ဇုန်အမည် — "ဈေးထဲမှာ" ဆိုတာ သိရင် အသင်းသားကို ဘယ်နေရာလဲ
      //   ပြောလို့ရတယ်။ ပြောင်းမှ setState လုပ်တယ် — frame တိုင်း
      //   ခေါ်ရင် React က တစ်စက္ကန့် ၆၀ ခါ re-render လုပ်မယ်။
      const here = zoneAt(ARENA, pos.x, pos.z)?.name ?? "";
      if (here !== zoneRef.current) {
        zoneRef.current = here;
        setZone(here);
      }

      const camDist = 6.5;
      const camX = pos.x + Math.sin(yaw) * camDist;
      const camZ = pos.z + Math.cos(yaw) * camDist;
      scene.camera.position.lerp(new THREE.Vector3(camX, 3.4, camZ), 0.18);
      scene.camera.lookAt(pos.x, 1.3, pos.z);

      scene.renderer.render(scene.scene, scene.camera);
    }

    function onResize() {
      const w = canvas!.clientWidth || window.innerWidth;
      const h = canvas!.clientHeight || window.innerHeight;
      scene.resize(w, h);
    }
    onResize();
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);

    // ★ Server နာရီကို snapshot ကနေ ယူတယ် — handler ထဲမှာ တစ်ခါတည်း
    //   မှတ်လိုက်ရင် closure က ရှုပ်လို့ ဒီမှာ patch လုပ်တယ်။
    const snapHandler = (t: number) => {
      if (!offsetSeen) {
        clockOffset = t - performance.now() - INTERP_DELAY_MS;
        offsetSeen = true;
      }
    };
    // net client က handler ကို constructor မှာပဲ လက်ခံတယ် — ဒါကြောင့်
    // interpolator ရဲ့ push ကို ဖြတ်ပြီး ပထမ timestamp ကို ယူတယ်။
    const origPush = interp.push.bind(interp);
    interp.push = (id, sample) => {
      snapHandler(sample.t);
      origPush(id, sample);
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      net.close();
      netRef.current = null;
      scene.dispose();
    };
  }, [room, sendTag]);

  // ── နာရီ ────────────────────────────────────────────────────────────
  useEffect(() => {
    const target = state.state === "countdown" ? state.countdownEndsAt : state.endsAt;
    if (!target) {
      setClock("");
      return;
    }
    const tick = () => {
      const left = Math.max(0, target - Date.now());
      const s = Math.ceil(left / 1000);
      setClock(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 500);
    return () => clearInterval(id);
  }, [state.state, state.endsAt, state.countdownEndsAt]);

  const iAmSeeker = selfId !== null && seekerId === selfId;

  return (
    <div className="relative h-[100dvh] w-full touch-none overflow-hidden bg-slate-900">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Gwave branded loading — server နဲ့ မချိတ်မိသေးသရွေ့ */}
      {selfId === null && !denied ? (
        <BrandedLoading title="🙈 ဝှက်တမ်း ထဲ ဝင်နေသည်…" subtitle="Gwave Arena" />
      ) : null}

      {/* ── အပေါ်ဘား ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="rounded-xl bg-black/55 px-3 py-2 text-white backdrop-blur">
          <div className="text-[11px] uppercase tracking-wide opacity-70">ဝှက်တမ်း</div>
          <div className="text-sm font-black">
            {state.state === "waiting" && "ကစားသမား စောင့်နေသည်"}
            {state.state === "countdown" && `စတော့မယ် ${clock}`}
            {state.state === "live" && (iAmSeeker ? "🔴 သင်က ရှာဖွေသူ" : "🔵 ပုန်းပါ")}
            {state.state === "ended" && "ပွဲပြီးပါပြီ"}
          </div>
          {zone && <div className="text-[11px] opacity-80">{zone}</div>}
        </div>

        {state.state === "live" && clock && (
          <div className="rounded-xl bg-black/55 px-3 py-2 text-lg font-black tabular-nums text-white backdrop-blur">
            {clock}
          </div>
        )}
      </div>

      {/* ── အခြေအနေ ── */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white/80">
        {status}
        {role === "spectator" && " · ကြည့်ရှုနေသည် (နောက်ပွဲ စောင့်ပါ)"}
      </div>

      {/* ── ★ ဖမ်းခလုတ် — ရှာဖွေသူဖြစ်ပြီး ကပ်နေမှသာ ── */}
      {tagTarget && (
        <button
          type="button"
          onClick={sendTag}
          className="absolute bottom-24 right-6 h-24 w-24 rounded-full bg-red-600 text-lg font-black text-white shadow-xl active:scale-95"
        >
          ဖမ်း
        </button>
      )}

      {/* ── စောင့်ခန်း ── */}
      {(state.state === "waiting" || state.state === "countdown") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
          <div className="rounded-2xl bg-black/60 px-5 py-3 text-center text-white backdrop-blur">
            <div className="text-sm font-bold">
              {state.state === "countdown"
                ? `ပွဲစတော့မယ် — ${clock}`
                : `ကစားသမား ${state.players?.length ?? 0} / ${state.minPlayers ?? 3} ယောက် လိုသည်`}
            </div>
            <div className="mt-1 text-[11px] opacity-75">
              ဘယ်ဘက် ဆွဲ = ရွေ့ · ညာဘက် ဆွဲ = လှည့်ကြည့်
            </div>
          </div>
        </div>
      )}

      {/* ── ရလဒ် ── */}
      {state.state === "ended" && state.result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 text-white">
            <div className="text-lg font-black">
              {state.result.winnerId === selfId ? "🏆 သင် အနိုင်ရသည်" : "ပွဲပြီးပါပြီ"}
            </div>
            <div className="mt-1 text-xs opacity-70">
              {state.result.reason === "time" && "အချိန်ကုန်သွားပါပြီ"}
              {state.result.reason === "all-caught" && "အားလုံး ဖမ်းမိသွားပါပြီ"}
              {state.result.reason === "abandoned" && "ကစားသမား မကျန်တော့ပါ"}
            </div>
            <ol className="mt-3 space-y-1 text-sm">
              {state.result.scores.slice(0, 8).map((s, i) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {i + 1}. {s.name}
                    {s.id === selfId && " (သင်)"}
                  </span>
                  <span className="font-bold tabular-nums">{s.score}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 text-[11px] opacity-70">နောက်ပွဲ အလိုအလျောက် စပါမည်…</div>
          </div>
        </div>
      )}

      {/* ── ဝင်ခွင့် ငြင်းခံရ ── */}
      {denied && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="max-w-xs rounded-2xl bg-slate-800 p-5 text-center text-white">
            <div className="text-sm font-bold">{denied}</div>
          </div>
        </div>
      )}
    </div>
  );
}
