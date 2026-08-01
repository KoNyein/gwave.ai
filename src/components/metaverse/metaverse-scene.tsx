"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createHuman, type Avatar, type HumanState } from "./human";
import { connectMetaverse, type NetClient, type RemoteState } from "./net";
import { buildWorld, resolveCollision, WORLD_RADIUS } from "./world";

/// Gwave Metaverse ရဲ့ အဓိက client component။
///
/// ★ စည်းမျဉ်း ၂ ခု — ဒီ ၂ ခုက performance ရဲ့ အခြေခံ:
///   1. Player ရဲ့ နေရာ/လှည့်ထောင့်ကို React state ထဲ **လုံးဝမထား** —
///      60fps မှာ setState ခေါ်ရင် တစ်စက္ကန့် re-render ၆၀ ခါဖြစ်ပြီး
///      ဖုန်းက ပူလာမယ်။ ref နဲ့ mutable object ထဲမှာသာထားတယ်။
///   2. useEffect ရဲ့ cleanup က renderer, geometry, material, RAF, listener
///      အားလုံးကို ပြန်ရှင်းရမယ် — page ကူးတိုင်း WebGL context တစ်ခုစီ
///      ကျန်ခဲ့ရင် browser က ~16 ခုပြည့်တာနဲ့ context အဟောင်းတွေ ဖျက်ပစ်တယ်။

const EMOTES = [
  { key: "wave" as const, icon: "👋", label: "နှုတ်ဆက်" },
  { key: "dance" as const, icon: "🕺", label: "ကခုန်" },
  { key: "sit" as const, icon: "🪑", label: "ထိုင်" },
];

/// နေ့တစ်ရက် = ၃ မိနစ် (spec)။
const DAY_SECONDS = 180;

/// WS URL မရှိရင် networking လုံးဝမလုပ်ဘူး — လောကက single-player အဖြစ်
/// ပုံမှန်ဖွင့်ရမယ်။ (Progressive: server ကျနေရင်လည်း အတူတူပဲ။)
const WS_URL = process.env.NEXT_PUBLIC_MV_WS_URL || "";
const ROOM = process.env.NEXT_PUBLIC_MV_ROOM || "city";

/// Player id ကနေ အဝတ်အရောင် — တစ်ယောက်နဲ့တစ်ယောက် ခွဲမြင်ရဖို့။
/// Server ကနေ အရောင်မပို့ဘဲ id ကနေ တွက်တာက packet မလိုဘဲ တည်ငြိမ်တယ်
/// (client တိုင်းမှာ id တူရင် အရောင်တူတယ်)။
const CLOTH_COLORS = [
  0xe94f37, 0x3f88c5, 0xf6ae2d, 0x44bba4, 0xa06cd5, 0xff8c42, 0x6cc551,
];
function colorFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CLOTH_COLORS[h % CLOTH_COLORS.length] ?? 0x44bba4;
}

type Remote = {
  avatar: Avatar;
  /// မျက်နှာပြင်မှာ ပြနေတဲ့ နေရာ (ချောချောလိုက်တယ်)
  cur: { x: number; y: number; z: number; ry: number };
  /// Server ကနေ နောက်ဆုံးရလာတဲ့ နေရာ
  target: { x: number; y: number; z: number; ry: number };
  name: string;
  emote: HumanState["emote"];
  speed: number;
};

type ChatLine = {
  id: string;
  name: string;
  text: string;
  at: number;
  /// Gwave account နဲ့ ဝင်ထားသူလား၊ ဧည့်သည်လား — နာမည်ကို ကြည့်ပြီး
  /// ခွဲလို့မရဘူး၊ ဧည့်သည်က ဘယ်နာမည်မဆို ပေးလို့ရလို့။
  authed: boolean;
};

const WALK_SPEED = 4.2;
const RUN_SPEED = 8.4;
const JUMP_V = 6.2;
const GRAVITY = 18;

type Input = {
  f: number; // ရှေ့
  b: number; // နောက်
  l: number;
  r: number;
  run: boolean;
  jump: boolean;
  /// Mobile joystick — -1..1
  jx: number;
  jz: number;
};

export function MetaverseScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [emote, setEmote] = useState<HumanState["emote"]>(null);
  // ဒီ ၃ ခုက မကြာခဏမပြောင်းလို့ React state နဲ့ ရတယ် (position မဟုတ်ဘူး)
  const [online, setOnline] = useState(1);
  const [link, setLink] = useState<"off" | "connecting" | "live" | "auth">(
    WS_URL ? "connecting" : "off",
  );
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [meName, setMeName] = useState("");
  const [meAuthed, setMeAuthed] = useState(false);
  const netRef = useRef<NetClient | null>(null);

  // Emote ကို ref နဲ့ ကူးထားတယ် — render loop က state ကို closure ထဲ
  // ဖမ်းထားလို့ တိုက်ရိုက်ဖတ်ရင် အဟောင်းပဲ ရမယ်။
  const emoteRef = useRef<HumanState["emote"]>(null);
  useEffect(() => {
    emoteRef.current = emote;
    // တခြားသူတွေလည်း မြင်ရအောင် — emote က ငြိမ်နေမှ ပေါ်တာမို့ ဒါက
    // မကြာခဏ ပို့တဲ့ message မဟုတ်ဘူး။
    netRef.current?.sendEmote(emote);
  }, [emote]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    // ★ devicePixelRatio ကို ၂ မှာ ကန့်သတ် — iPhone က 3 ပြန်ပေးတယ်၊
    // pixel ၉ ဆ ဆွဲရတာက ဘက်ထရီကုန်ပြီး frame ကျတယ်။
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      500,
    );

    const world = buildWorld(scene);

    // ── ကိုယ့်လူရုပ် ───────────────────────────────────────────────────────
    const me: Avatar = createHuman(0x44bba4, 0xe8b088);
    scene.add(me.group);

    // Player ရဲ့ အခြေအနေ — ★ React state မဟုတ်၊ mutable object
    const p = { x: 0, y: 0, z: 12, ry: Math.PI, vy: 0, airborne: false };
    const cam = { yaw: Math.PI, pitch: 0.34, dist: 7.5 };

    const input: Input = {
      f: 0,
      b: 0,
      l: 0,
      r: 0,
      run: false,
      jump: false,
      jx: 0,
      jz: 0,
    };

    // ── Multiplayer ───────────────────────────────────────────────────────
    const remotes = new Map<string, Remote>();

    const addRemote = (id: string, s: RemoteState) => {
      if (remotes.has(id)) return;
      const avatar = createHuman(colorFor(id));
      avatar.group.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
      scene.add(avatar.group);
      remotes.set(id, {
        avatar,
        cur: { x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, ry: s.ry ?? 0 },
        target: { x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, ry: s.ry ?? 0 },
        name: s.name ?? "Gwave",
        emote: (s.emote as HumanState["emote"]) ?? null,
        speed: 0,
      });
      setOnline(remotes.size + 1);
    };

    const dropRemote = (id: string) => {
      const r = remotes.get(id);
      if (!r) return;
      r.avatar.dispose();
      remotes.delete(id);
      setOnline(remotes.size + 1);
    };

    let net: NetClient | null = null;
    if (WS_URL) {
      net = connectMetaverse(WS_URL, ROOM, {
        onInit: ({ players, name, authed }) => {
          for (const [id, s] of Object.entries(players)) addRemote(id, s);
          setMeName(name);
          setMeAuthed(authed);
          setLink("live");
        },
        onJoin: (id, s) => addRemote(id, s),
        onLeave: dropRemote,
        onUpdate: (id, x, y, z, ry) => {
          const r = remotes.get(id);
          if (!r) return;
          // ★ target ကိုပဲ ချိန်တယ် — cur ကို frame တိုင်း ဆွဲသွားမယ်။
          // တိုက်ရိုက်ထည့်ရင် 15Hz packet အတိုင်း ခုန်ခုန်သွားမယ်။
          r.target.x = x;
          r.target.y = y;
          r.target.z = z;
          r.target.ry = ry;
        },
        onEmote: (id, e) => {
          const r = remotes.get(id);
          if (r) r.emote = (e as HumanState["emote"]) ?? null;
        },
        onChat: (id, name, text, authed) => {
          setChat((prev) => [
            ...prev.slice(-40),
            { id, name, text, at: Date.now(), authed },
          ]);
        },
        onName: (id, name) => {
          const r = remotes.get(id);
          if (r) r.name = name;
        },
        onCorrect: (x, y, z) => {
          // Server က ငြင်းလိုက်တယ် — server ရဲ့ နေရာက အမှန်။
          p.x = x;
          p.y = y;
          p.z = z;
        },
        onStatus: (connected, detail) => {
          if (connected) setLink("live");
          else if (detail === "auth") setLink("auth");
          else setLink("connecting");
        },
      });
      netRef.current = net;
    }

    // ── Keyboard ──────────────────────────────────────────────────────────
    const keyMap: Record<string, keyof Input> = {
      KeyW: "f",
      ArrowUp: "f",
      KeyS: "b",
      ArrowDown: "b",
      KeyA: "l",
      ArrowLeft: "l",
      KeyD: "r",
      ArrowRight: "r",
    };

    // ★ Chat ရိုက်နေတုန်း WASD က လူရုပ်ကို ရွှေ့သွားလို့မရဘူး — စာရိုက်နေရင်း
    // လောကထဲမှာ ပြေးနေတာ ဖြစ်မယ်။
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = keyMap[e.code];
      if (k) {
        (input[k] as number) = 1;
        e.preventDefault();
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.run = true;
      if (e.code === "Space") {
        input.jump = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = keyMap[e.code];
      if (k) (input[k] as number) = 0;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.run = false;
      if (e.code === "Space") input.jump = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── ကင်မရာ drag ───────────────────────────────────────────────────────
    let dragId: number | null = null;
    let dragX = 0;
    let dragY = 0;
    const onPointerDown = (e: PointerEvent) => {
      // Joystick ဧရိယာက touch ကို ကင်မရာ မယူရ
      if ((e.target as HTMLElement).dataset?.hud) return;
      dragId = e.pointerId;
      dragX = e.clientX;
      dragY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragId !== e.pointerId) return;
      cam.yaw -= (e.clientX - dragX) * 0.005;
      cam.pitch = THREE.MathUtils.clamp(
        cam.pitch + (e.clientY - dragY) * 0.004,
        -0.25,
        1.2,
      );
      dragX = e.clientX;
      dragY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragId === e.pointerId) dragId = null;
    };
    const onWheel = (e: WheelEvent) => {
      cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.01, 3, 18);
      e.preventDefault();
    };
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // ── Mobile joystick ───────────────────────────────────────────────────
    // DOM element ၂ ခုနဲ့ — React state မသုံးဘူး၊ touch တိုင်း re-render
    // ဖြစ်သွားမှာမို့။
    const stick = mount.querySelector<HTMLElement>("[data-stick]");
    const knob = mount.querySelector<HTMLElement>("[data-knob]");
    let stickId: number | null = null;
    const stickRadius = 46;

    const stickStart = (e: PointerEvent) => {
      stickId = e.pointerId;
      stick?.setPointerCapture(e.pointerId);
      stickMove(e);
    };
    const stickMove = (e: PointerEvent) => {
      if (stickId !== e.pointerId || !stick) return;
      const rect = stick.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const d = Math.min(1, Math.hypot(dx, dy) / stickRadius);
      const a = Math.atan2(dy, dx);
      input.jx = Math.cos(a) * d;
      // ★ မျက်နှာပြင်ရဲ့ "အပေါ်" (dy < 0) က ရှေ့သွားတာ ဖြစ်ရမယ်
      input.jz = -Math.sin(a) * d;
      if (knob) {
        knob.style.transform = `translate(${Math.cos(a) * d * stickRadius}px, ${
          Math.sin(a) * d * stickRadius
        }px)`;
      }
    };
    const stickEnd = (e: PointerEvent) => {
      if (stickId !== e.pointerId) return;
      stickId = null;
      input.jx = 0;
      input.jz = 0;
      if (knob) knob.style.transform = "translate(0px, 0px)";
    };
    stick?.addEventListener("pointerdown", stickStart);
    stick?.addEventListener("pointermove", stickMove);
    stick?.addEventListener("pointerup", stickEnd);
    stick?.addEventListener("pointercancel", stickEnd);

    const jumpBtn = mount.querySelector<HTMLElement>("[data-jump]");
    const jumpDown = () => {
      input.jump = true;
    };
    const jumpUp = () => {
      input.jump = false;
    };
    jumpBtn?.addEventListener("pointerdown", jumpDown);
    jumpBtn?.addEventListener("pointerup", jumpUp);
    jumpBtn?.addEventListener("pointercancel", jumpUp);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // ── Render loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let frames = 0;
    let fpsAcc = 0;
    let worldTime = 0.3; // မနက်ခင်း စတင်

    const tick = () => {
      raf = requestAnimationFrame(tick);
      // dt ကို ကန့်သတ် — tab ပြန်ဖွင့်ချိန်မှာ dt ကြီးကြီးဝင်လာရင်
      // player က နံရံဖြတ်ပြီး ခုန်ထွက်သွားမယ်။
      const dt = Math.min(clock.getDelta(), 0.05);

      // ── input → direction ──────────────────────────────────────────────
      const ix = THREE.MathUtils.clamp(input.r - input.l + input.jx, -1, 1);
      const iz = THREE.MathUtils.clamp(input.f - input.b + input.jz, -1, 1);

      // ★ Camera-relative — `iz` ကို negate မလုပ်ရ။ ကင်မရာက player ရဲ့
      // နောက်မှာ (yaw ဘက်ဆန့်ကျင်) ရှိလို့ `+iz` က ကင်မရာနဲ့ဝေးရာဘက်။
      let dirX = Math.sin(cam.yaw) * iz + Math.cos(cam.yaw) * ix;
      let dirZ = Math.cos(cam.yaw) * iz - Math.sin(cam.yaw) * ix;
      const mag = Math.hypot(dirX, dirZ);
      if (mag > 1) {
        dirX /= mag;
        dirZ /= mag;
      }

      const wants = mag > 0.02;
      const running = input.run && wants;
      const speed = wants ? (running ? RUN_SPEED : WALK_SPEED) * Math.min(1, mag) : 0;

      // ── ခုန် ───────────────────────────────────────────────────────────
      if (input.jump && !p.airborne) {
        p.vy = JUMP_V;
        p.airborne = true;
      }
      if (p.airborne) {
        p.vy -= GRAVITY * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) {
          p.y = 0;
          p.vy = 0;
          p.airborne = false;
        }
      }

      // ── ရွှေ့ + collision ──────────────────────────────────────────────
      if (speed > 0) {
        const nx = p.x + dirX * speed * dt;
        const nz = p.z + dirZ * speed * dt;
        const solved = resolveCollision(nx, nz, p.x, p.z, world.colliders, WORLD_RADIUS);
        p.x = solved.x;
        p.z = solved.z;
        // မျက်နှာမူရာ — ရုတ်တရက်မလှည့်ဘဲ ချောချောလှည့်
        const targetRy = Math.atan2(dirX, dirZ);
        let diff = targetRy - p.ry;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.ry += diff * Math.min(1, 14 * dt);
      }

      me.group.position.set(p.x, p.y, p.z);
      me.group.rotation.y = p.ry;
      me.update(dt, {
        speed,
        running,
        airborne: p.airborne,
        emote: emoteRef.current,
      });

      // ── တခြား player တွေ ───────────────────────────────────────────────
      for (const r of remotes.values()) {
        const dx = r.target.x - r.cur.x;
        const dz = r.target.z - r.cur.z;
        const dist = Math.hypot(dx, dz);
        // ရွှေ့နှုန်းကနေ လမ်းလျှောက်/ပြေး animation ကို ခန့်မှန်းတယ် —
        // server က speed မပို့ဘူး၊ ပို့ရင် packet ကြီးလာမယ်။
        r.speed = dist > 0.02 ? Math.min(RUN_SPEED, dist / Math.max(dt, 0.016)) : 0;
        const k = Math.min(1, 12 * dt);
        r.cur.x += dx * k;
        r.cur.z += dz * k;
        r.cur.y += (r.target.y - r.cur.y) * k;
        let dry = r.target.ry - r.cur.ry;
        while (dry > Math.PI) dry -= Math.PI * 2;
        while (dry < -Math.PI) dry += Math.PI * 2;
        r.cur.ry += dry * k;

        r.avatar.group.position.set(r.cur.x, r.cur.y, r.cur.z);
        r.avatar.group.rotation.y = r.cur.ry;
        r.avatar.update(dt, {
          speed: r.speed,
          running: r.speed > 5,
          airborne: r.cur.y > 0.15,
          emote: r.emote,
        });
      }

      net?.sendUpdate(p.x, p.y, p.z, p.ry);

      // ── ကင်မရာ ─────────────────────────────────────────────────────────
      const cp = Math.cos(cam.pitch);
      camera.position.set(
        p.x - Math.sin(cam.yaw) * cp * cam.dist,
        p.y + 1.5 + Math.sin(cam.pitch) * cam.dist,
        p.z - Math.cos(cam.yaw) * cp * cam.dist,
      );
      camera.lookAt(p.x, p.y + 1.1, p.z);

      // ── နေ့/ည ──────────────────────────────────────────────────────────
      worldTime = (worldTime + dt / DAY_SECONDS) % 1;
      world.updateSky(worldTime);

      renderer.render(scene, camera);

      // FPS — ၂ စက္ကန့်တစ်ခါသာ state ထဲတင် (re-render နည်းအောင်)
      frames++;
      fpsAcc += dt;
      if (fpsAcc >= 2) {
        setFps(Math.round(frames / fpsAcc));
        frames = 0;
        fpsAcc = 0;
      }
    };

    setReady(true);
    tick();

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      stick?.removeEventListener("pointerdown", stickStart);
      stick?.removeEventListener("pointermove", stickMove);
      stick?.removeEventListener("pointerup", stickEnd);
      stick?.removeEventListener("pointercancel", stickEnd);
      jumpBtn?.removeEventListener("pointerdown", jumpDown);
      jumpBtn?.removeEventListener("pointerup", jumpUp);
      jumpBtn?.removeEventListener("pointercancel", jumpUp);
      net?.close();
      netRef.current = null;
      for (const r of remotes.values()) r.avatar.dispose();
      remotes.clear();
      me.dispose();
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, []);

  return (
    <div ref={mountRef} className="relative h-full w-full">
      {/* ── HUD ─────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 select-none rounded-lg bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-white/80 backdrop-blur">
        <div className="font-semibold text-emerald-300">Gwave Metaverse</div>
        <div className="hidden sm:block">WASD ရွှေ့ · Shift ပြေး · Space ခုန်</div>
        <div className="hidden sm:block">မောက်စ်ဆွဲ = ကင်မရာ · scroll = zoom</div>
        <div className="sm:hidden">ဘယ်ဘက် joystick · ညာဘက် ခုန်</div>
        {ready && (
          <div className="mt-1 flex items-center gap-2 text-white/50">
            <span>{fps} fps</span>
            <span>·</span>
            <span
              className={
                link === "live"
                  ? "text-emerald-400"
                  : link === "auth"
                    ? "text-amber-400"
                    : "text-white/40"
              }
            >
              {link === "live"
                ? `👥 ${online}`
                : link === "connecting"
                  ? "ချိတ်နေသည်…"
                  : link === "auth"
                    ? "login လိုသည်"
                    : "တစ်ယောက်တည်း"}
            </span>
          </div>
        )}

        {/* ── ကိုယ်ဘယ်သူလဲ ───────────────────────────────────────────── */}
        {link === "live" && (
          <div className="pointer-events-auto mt-1 flex items-center gap-1.5">
            {meAuthed ? (
              <span className="text-emerald-300">👤 {meName}</span>
            ) : (
              <>
                {/* ဧည့်သည်က နာမည်ကို ကိုယ်တိုင်ပေးလို့ရတယ်။ Server က
                    authed=false ကို အမြဲတွဲပို့လို့ Gwave အကောင့်ရှိသူတစ်ယောက်
                    အဖြစ် ဟန်ဆောင်လို့ မရဘူး။ */}
                <input
                  data-hud="1"
                  value={meName}
                  onChange={(e) => setMeName(e.target.value.slice(0, 24))}
                  onBlur={() => netRef.current?.sendName(meName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      netRef.current?.sendName(meName);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  maxLength={24}
                  aria-label="ဧည့်သည် နာမည်"
                  className="w-28 rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-emerald-400/60"
                />
                <span className="rounded bg-white/15 px-1 text-[9px] text-white/60">
                  ဧည့်သည်
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Guest ကို sign in ဖိတ်ခေါ်တာ — မဖြစ်မနေမဟုတ်ဘူး၊ ရွေးစရာတစ်ခုပဲ */}
      {link === "live" && !meAuthed && (
        <a
          href="/login"
          data-hud="1"
          className="absolute right-3 top-3 z-10 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur hover:bg-black/60"
        >
          Gwave နဲ့ ဝင်မယ်
        </a>
      )}

      {/* ── Chat ─────────────────────────────────────────────────────── */}
      {link !== "off" && (
        <div className="absolute bottom-20 left-3 z-10 w-[min(19rem,60vw)] sm:bottom-3 sm:w-72">
          <div className="mb-1 max-h-40 space-y-0.5 overflow-hidden">
            {chat.slice(-6).map((c, i) => (
              <div
                key={`${c.at}-${i}`}
                className="w-fit max-w-full rounded bg-black/45 px-2 py-1 text-[11px] leading-snug text-white/90 backdrop-blur"
              >
                <span
                  className={
                    c.authed
                      ? "font-semibold text-emerald-300"
                      : "font-semibold text-white/70"
                  }
                >
                  {c.name}
                </span>
                {/* ★ ဧည့်သည်ကို အမြဲ အမှတ်အသားပြ — မပြရင် ဧည့်သည်တစ်ယောက်က
                    တခြားသူ့နာမည်ပေးပြီး အဲဒီလူအဖြစ် ဟန်ဆောင်လို့ရမယ် */}
                {!c.authed && (
                  <span className="ml-1 rounded bg-white/15 px-1 text-[9px] text-white/60">
                    ဧည့်သည်
                  </span>
                )}{" "}
                {/* textContent အဖြစ်သာ ထည့်တယ် — innerHTML သုံးရင် chat ကနေ
                    script ထည့်လို့ရသွားမယ် */}
                {c.text}
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              netRef.current?.sendChat(t);
              setDraft("");
            }}
          >
            <input
              data-hud="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              placeholder="စာရိုက်ရန်…"
              className="w-full rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-white outline-none backdrop-blur placeholder:text-white/35 focus:border-emerald-400/60"
            />
          </form>
        </div>
      )}

      {/* Emote bar */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {EMOTES.map((e) => (
          <button
            key={e.key}
            data-hud="1"
            onClick={() => setEmote(emote === e.key ? null : e.key)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg backdrop-blur transition ${
              emote === e.key
                ? "border-emerald-400 bg-emerald-500/30"
                : "border-white/20 bg-black/40 hover:bg-black/60"
            }`}
            aria-label={e.label}
            title={e.label}
          >
            {e.icon}
          </button>
        ))}
      </div>

      {/* Mobile joystick — sm အထက်မှာ ဖျောက် */}
      <div
        data-stick
        data-hud="1"
        className="absolute bottom-6 left-6 z-10 h-28 w-28 touch-none rounded-full border border-white/20 bg-black/30 backdrop-blur sm:hidden"
      >
        <div
          data-knob
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30"
        />
      </div>
      <button
        data-jump
        data-hud="1"
        className="absolute bottom-8 right-6 z-10 h-20 w-20 touch-none rounded-full border border-white/20 bg-black/30 text-sm text-white/80 backdrop-blur sm:hidden"
      >
        ခုန်
      </button>
    </div>
  );
}
