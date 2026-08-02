"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { buildArena, createToonFighter, createWeaponModel, type Fighter } from "./toon";

/// Gwave Assassin — ၁၈+ multiplayer mini-game (three.js)。
///
/// ★ ကစားနည်း — လူတိုင်းမှာ လျှို့ဝှက်ပစ်မှတ် တစ်ယောက်စီ။ ကိုယ့်ကို ဘယ်သူ
///   လိုက်နေလဲ မသိရဘူး။ မှန်တဲ့သူရရင် +၁၊ လူမှားရင် −၁။
/// ★ Server က ဆုံးဖြတ်တယ် — client က "ဒီလူကို ဒီနေရာမှာ ထိတယ်" ဆိုပြီး
///   အကြံပြုရုံပဲ။ ပစ်နှုန်း၊ ကျည်၊ အကွာအဝေး၊ ရွေ့လျားမှုအမြန်နှုန်း အားလုံး
///   metaverse server မှာ ပြန်စစ်တယ် (server/metaverse/assassin.js)。
/// ★ Skin က **အလှသာ** — ဘယ်ဟာမှ ကာကွယ်မှု မပေးဘူး။

type Weapon = { my: string; dmg: number; range: number; fireMs: number; ammo: number; splash: number };
type Skin = { my: string; color: number };
type Pub = {
  id: string; name: string; skin: string;
  x: number; y: number; z: number; ry: number;
  hp: number; alive: boolean; kills: number; score: number; weapon: string;
};
type You = {
  id: string; hp: number; alive: boolean; kills: number; score: number;
  wrongKills: number; weapon: string; skin: string;
  ammo: Record<string, number>;
  target: { id: string; name: string } | null;
};

type Feed = { id: number; text: string; good: boolean };

const WS_URL = process.env.NEXT_PUBLIC_MV_WS_URL || "";
function wsCandidates(): string[] {
  const out: string[] = [];
  if (WS_URL) out.push(WS_URL);
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const same = `wss://${window.location.host}/mv/ws`;
    if (!out.includes(same)) out.push(same);
  }
  return out;
}

const EYE = 1.6;
const SPEED = 8;

export function AssassinGame({ room }: { room: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<{
    you: You | null;
    board: Pub[];
    online: number;
    link: "connecting" | "live" | "denied" | "offline";
    killsToWin: number;
  }>({ you: null, board: [], online: 0, link: "connecting", killsToWin: 3 });
  const [feed, setFeed] = useState<Feed[]>([]);
  const [weapons, setWeapons] = useState<Record<string, Weapon>>({});
  const sendRef = useRef<((m: Record<string, unknown>) => void) | null>(null);

  useEffect(() => {
    if (!started) return;
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ec9e8);
    scene.fog = new THREE.Fog(0x9ec9e8, 45, 95);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    let arena = 30;
    buildArena(scene, arena);

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // ── ကစားသမားများ ───────────────────────────────────────────────────
    type Actor = { fighter: Fighter; data: Pub; target: THREE.Vector3; weapon: THREE.Group | null };
    const actors = new Map<string, Actor>();
    let meId = "";
    let skins: Record<string, Skin> = {};

    const me = { x: 0, y: 0, z: 0, ry: 0, pitch: 0, alive: true };

    function spawnActor(p: Pub) {
      if (actors.has(p.id)) return;
      const skin = skins[p.skin] ?? { my: "", color: 0xe07a5f };
      const fighter = createToonFighter({ color: skin.color, vest: p.skin === "knight" || p.skin === "commander" });
      fighter.group.position.set(p.x, p.y, p.z);
      fighter.group.rotation.y = p.ry;
      fighter.group.userData.playerId = p.id;
      scene.add(fighter.group);
      const w = createWeaponModel(p.weapon);
      fighter.hand.add(w);
      actors.set(p.id, { fighter, data: p, target: new THREE.Vector3(p.x, p.y, p.z), weapon: w });
    }
    function dropActor(id: string) {
      const a = actors.get(id);
      if (!a) return;
      scene.remove(a.fighter.group);
      actors.delete(id);
    }

    // ── ချိတ်ဆက်မှု ────────────────────────────────────────────────────
    let ws: WebSocket | null = null;
    let closed = false;
    let feedSeq = 0;

    const pushFeed = (text: string, good: boolean) => {
      const id = feedSeq++;
      setFeed((f) => [...f.slice(-4), { id, text, good }]);
      setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 5000);
    };

    const send = (m: Record<string, unknown>) => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
    };
    sendRef.current = send;

    (async () => {
      const urls = wsCandidates();
      if (urls.length === 0) {
        setHud((h) => ({ ...h, link: "offline" }));
        return;
      }
      let ticket: string | null = null;
      try {
        const res = await fetch("/api/metaverse/ws-ticket", { cache: "no-store" });
        if (res.ok) ticket = ((await res.json()) as { ticket?: string }).ticket ?? null;
      } catch {
        /* ticket မရရင် server က ငြင်းမယ် — အောက်မှာ ကိုင်တွယ်ထားတယ် */
      }
      if (closed) return;
      const qs = new URLSearchParams({ room });
      if (ticket) qs.set("ticket", ticket);
      ws = new WebSocket(`${urls[0]}?${qs.toString()}`);

      ws.onopen = () => {
        setHud((h) => ({ ...h, link: "live" }));
        send({ type: "aJoin" });
      };
      // ★ 4005/4006 = ဝင်မထားဘူး / ၁၈+ မဟုတ်ဘူး — server ရဲ့ ဆုံးဖြတ်ချက်။
      //   Client မှာ ခလုတ်ဖျောက်ရုံနဲ့ မလုံခြုံလို့ ဂိတ်က server မှာ။
      ws.onclose = (e) => {
        if (closed) return;
        setHud((h) => ({ ...h, link: e.code === 4005 || e.code === 4006 ? "denied" : "offline" }));
      };

      ws.onmessage = (ev) => {
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (m.type) {
          case "aInit": {
            meId = String(m.id);
            skins = m.skins as Record<string, Skin>;
            setWeapons(m.weapons as Record<string, Weapon>);
            arena = Number(m.arena) || 30;
            setHud((h) => ({ ...h, killsToWin: Number(m.killsToWin) || 3 }));
            for (const p of m.players as Pub[]) {
              if (p.id === meId) {
                me.x = p.x; me.z = p.z; me.ry = p.ry;
              } else spawnActor(p);
            }
            setHud((h) => ({ ...h, board: m.players as Pub[], online: (m.players as Pub[]).length }));
            break;
          }
          case "aEnter": {
            const p = m.player as Pub;
            if (p.id !== meId) spawnActor(p);
            setHud((h) => ({ ...h, board: [...h.board.filter((b) => b.id !== p.id), p], online: h.online + 1 }));
            break;
          }
          case "aLeave": {
            dropActor(String(m.id));
            setHud((h) => ({ ...h, board: h.board.filter((b) => b.id !== m.id), online: Math.max(0, h.online - 1) }));
            break;
          }
          case "aMove": {
            const a = actors.get(String(m.id));
            if (a) {
              a.target.set(Number(m.x), Number(m.y), Number(m.z));
              a.data.ry = Number(m.ry);
            }
            break;
          }
          case "aYou":
            setHud((h) => ({ ...h, you: m.you as You }));
            me.alive = (m.you as You).alive;
            break;
          case "aHit": {
            const a = actors.get(String(m.victimId));
            if (a) a.data.hp = Number(m.hp);
            if (m.victimId === meId) flash();
            break;
          }
          case "aKill": {
            const correct = m.correct === true;
            const mine = m.killerId === meId;
            pushFeed(
              `${m.killerName} → ${m.victimName}${correct ? " ✓" : " ✗ (လူမှား)"}`,
              correct,
            );
            const v = actors.get(String(m.victimId));
            if (v) {
              v.data.alive = false;
              v.fighter.group.visible = false;
            }
            if (m.victimId === meId) me.alive = false;
            if (mine && !correct) pushFeed("လူမှားသတ်မိလို့ အမှတ် လျော့သွားတယ်", false);
            break;
          }
          case "aRespawn": {
            const a = actors.get(String(m.id));
            if (a) {
              a.data.alive = true;
              a.data.hp = Number(m.hp);
              a.fighter.group.visible = true;
              a.target.set(Number(m.x), Number(m.y), Number(m.z));
              a.fighter.group.position.copy(a.target);
            }
            if (m.id === meId) {
              me.x = Number(m.x); me.z = Number(m.z); me.alive = true;
            }
            break;
          }
          case "aWin":
            pushFeed(`🏆 ${m.winnerName} အနိုင်ရပါပြီ`, true);
            break;
          case "aReset": {
            for (const p of m.players as Pub[]) {
              const a = actors.get(p.id);
              if (a) {
                a.data = p;
                a.fighter.group.visible = true;
                a.target.set(p.x, p.y, p.z);
              }
              if (p.id === meId) { me.x = p.x; me.z = p.z; me.alive = true; }
            }
            setHud((h) => ({ ...h, board: m.players as Pub[] }));
            pushFeed("ပွဲအသစ် စပါပြီ", true);
            break;
          }
          case "aWeaponOf": {
            const a = actors.get(String(m.id));
            if (a) {
              if (a.weapon) a.fighter.hand.remove(a.weapon);
              a.weapon = createWeaponModel(String(m.weapon));
              a.fighter.hand.add(a.weapon);
            }
            break;
          }
          case "aNoAmmo":
            pushFeed("ကျည် ကုန်သွားပြီ — R နှိပ်ပြီး ဖြည့်ပါ", false);
            break;
        }
      };
    })();

    // ── ထိမှန်မှု အနီရောင် ────────────────────────────────────────────
    let hurtUntil = 0;
    const flash = () => {
      hurtUntil = performance.now() + 220;
    };

    // ── ထိန်းချုပ်မှု ──────────────────────────────────────────────────
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code === "KeyR") send({ type: "aReload" });
      if (e.code === "Digit1") send({ type: "aWeapon", weapon: "pistol" });
      if (e.code === "Digit2") send({ type: "aWeapon", weapon: "knife" });
      if (e.code === "Digit3") send({ type: "aWeapon", weapon: "sniper" });
      if (e.code === "Digit4") send({ type: "aWeapon", weapon: "bomb" });
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const canvas = renderer.domElement;
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      me.ry -= e.movementX * 0.0022;
      me.pitch = Math.max(-1.2, Math.min(1.2, me.pitch - e.movementY * 0.0022));
    };
    const requestLock = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
    };
    canvas.addEventListener("click", requestLock);
    window.addEventListener("mousemove", onMouseMove);

    // ── ပစ်ခတ်ခြင်း ────────────────────────────────────────────────────
    //
    // ★ Client က raycast လုပ်ပြီး "ဘယ်သူ့ကို ဘယ်နေရာမှာ" ဆိုတာ အကြံပြုတယ်။
    //   Server က အကွာအဝေး/ပစ်နှုန်း/ကျည် ပြန်စစ်တယ် — ဒါကြောင့် raycast
    //   လိမ်ညာလို့ ရပေမယ့် အကွာအဝေး ကျော်လို့ မရဘူး။
    const ray = new THREE.Raycaster();
    const centre = new THREE.Vector2(0, 0);
    const fire = () => {
      if (!me.alive) return;
      const w = hud.you?.weapon ?? "pistol";
      if (w === "bomb") {
        // ဗုံး — ရှေ့ ၈ မီတာ အကွာကို ပစ်တယ်
        send({ type: "aFire", x: me.x - Math.sin(me.ry) * 8, z: me.z - Math.cos(me.ry) * 8 });
        return;
      }
      ray.setFromCamera(centre, camera);
      const targets: THREE.Object3D[] = [];
      for (const a of actors.values()) {
        if (a.data.alive) targets.push(a.fighter.headHit, a.fighter.bodyHit);
      }
      const hits = ray.intersectObjects(targets, false);
      const first = hits[0];
      if (!first) {
        send({ type: "aFire" });
        return;
      }
      const pid = first.object.parent?.userData?.playerId;
      send({
        type: "aFire",
        targetId: pid,
        hitPart: first.object.userData.part === "head" ? "head" : "body",
      });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement === canvas) fire();
    };
    window.addEventListener("mousedown", onMouseDown);

    // ဖုန်းအတွက် — ဖန်သားပြင်ကို ထိရင် ပစ်တယ်
    const onTouch = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (t0 && t0.clientX > window.innerWidth / 2) fire();
    };
    canvas.addEventListener("touchstart", onTouch);

    // ── Loop ───────────────────────────────────────────────────────────
    let raf = 0;
    let last = performance.now();
    let sendAcc = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (me.alive) {
        let fx = 0;
        let fz = 0;
        if (keys.has("KeyW")) fz -= 1;
        if (keys.has("KeyS")) fz += 1;
        if (keys.has("KeyA")) fx -= 1;
        if (keys.has("KeyD")) fx += 1;
        const len = Math.hypot(fx, fz);
        if (len > 0) {
          fx /= len;
          fz /= len;
          const sin = Math.sin(me.ry);
          const cos = Math.cos(me.ry);
          me.x += (fx * cos - fz * sin) * SPEED * dt;
          me.z += (-fx * sin - fz * cos) * SPEED * dt;
          const r = Math.hypot(me.x, me.z);
          if (r > arena) {
            me.x = (me.x / r) * arena;
            me.z = (me.z / r) * arena;
          }
        }
      }

      camera.position.set(me.x, EYE, me.z);
      camera.rotation.set(me.pitch, me.ry, 0, "YXZ");

      // တခြားသူတွေကို ချောချောရွှေ့ + လမ်းလျှောက်ပုံစံ
      for (const a of actors.values()) {
        a.fighter.group.position.lerp(a.target, Math.min(1, 12 * dt));
        let d = a.data.ry - a.fighter.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        a.fighter.group.rotation.y += d * Math.min(1, 12 * dt);
        const moving = a.fighter.group.position.distanceToSquared(a.target) > 0.002;
        const sw = moving ? Math.sin(now / 130) * 0.5 : 0;
        a.fighter.legL.rotation.x = sw;
        a.fighter.legR.rotation.x = -sw;
        a.fighter.armL.rotation.x = -sw * 0.6;
      }

      sendAcc += dt;
      if (sendAcc > 1 / 15) {
        sendAcc = 0;
        send({ type: "aMove", x: me.x, y: 0, z: me.z, ry: me.ry });
      }

      renderer.render(scene, camera);
      const el = hurtRef.current;
      if (el) el.style.opacity = now < hurtUntil ? "1" : "0";
    };
    raf = requestAnimationFrame(tick);

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("click", requestLock);
      canvas.removeEventListener("touchstart", onTouch);
      ws?.close();
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      sendRef.current = null;
    };
    // ★ `hud` က frame တိုင်း ပြောင်းလို့ dep ထဲ မထည့်ရ — ထည့်ရင် scene
    //   တစ်ခုလုံး ပြန်ဆောက်နေမယ်။
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, room]);

  const hurtRef = useRef<HTMLDivElement | null>(null);
  const you = hud.you;

  if (!started) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold">🎯 Gwave Assassin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          လူတိုင်းမှာ <b>လျှို့ဝှက်ပစ်မှတ်</b> တစ်ယောက်စီ ရှိတယ်။ ကိုယ့်ကို ဘယ်သူ
          လိုက်ရှာနေလဲတော့ မသိရဘူး။ မှန်တဲ့ပစ်မှတ်ကို ရရင် <b>+၁</b>၊ လူမှားရင်{" "}
          <b>−၁</b> — ဒါကြောင့် ပစ်ခတ်တာထက် <b>ရှာဖွေတာ</b> က အဓိကပါ။
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li>⌨️ WASD = ရွှေ့ · မောက်စ် = ကြည့် · ကလစ် = ပစ် · R = ကျည်ဖြည့် · 1–4 = လက်နက်</li>
          <li>📱 ဖုန်းမှာ ညာဘက်ခြမ်း ထိရင် ပစ်တယ်</li>
          <li>🎨 Skin တွေက <b>အလှသာ</b> — ဘယ်ဟာမှ ကာကွယ်မှု အပိုမပေးပါ</li>
        </ul>
        <button
          onClick={() => setStarted(true)}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          ▶ ဝင်မယ်
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border bg-black">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={hurtRef}
        className="pointer-events-none absolute inset-0 bg-red-600/25 opacity-0 transition-opacity duration-150"
      />

      {/* ကြက်ခြေခတ် */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70">
        ✛
      </div>

      {/* ဘယ်အပေါ် — ပစ်မှတ် */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/55 px-3 py-2 text-[12px] text-white backdrop-blur">
        {hud.link === "denied" ? (
          <span className="text-amber-300">၁၈+ ဖြစ်ပြီး Gwave အကောင့်နဲ့ ဝင်ထားမှ ကစားလို့ရပါတယ်</span>
        ) : hud.link !== "live" ? (
          <span className="text-white/70">ချိတ်နေသည်…</span>
        ) : you?.target ? (
          <>
            <div className="text-white/60">🎯 ကိုယ့်ပစ်မှတ်</div>
            <div className="text-sm font-bold text-emerald-300">{you.target.name}</div>
          </>
        ) : (
          <span className="text-white/60">ပစ်မှတ် စောင့်နေသည် — လူ ၂ ယောက် လိုတယ်</span>
        )}
      </div>

      {/* ညာအပေါ် — အမှတ်ပေးဇယား */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/55 px-3 py-2 text-[11px] text-white backdrop-blur">
        <div className="mb-1 text-white/60">👥 {hud.online} · ⭐ {hud.killsToWin} ရရင် အနိုင်</div>
        {[...hud.board].sort((a, b) => b.score - a.score).slice(0, 5).map((p) => (
          <div key={p.id} className="flex justify-between gap-3">
            <span className="truncate">{p.name}</span>
            <span className="tabular-nums text-emerald-300">{p.score}</span>
          </div>
        ))}
      </div>

      {/* အောက် — ကျန်းမာရေး + ကျည် */}
      {you && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-[12px] text-white backdrop-blur">
          <div className="flex items-center gap-2">
            <span className={you.hp > 40 ? "text-emerald-300" : "text-red-400"}>❤ {you.hp}</span>
            <span className="text-white/70">
              {weapons[you.weapon]?.my ?? you.weapon} ·{" "}
              {you.ammo[you.weapon] === -1 ? "∞" : you.ammo[you.weapon]}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/50">
            ✓ {you.kills} · ✗ {you.wrongKills} · အမှတ် {you.score}
          </div>
        </div>
      )}

      {/* သတင်းစဉ် */}
      <div className="pointer-events-none absolute bottom-3 right-3 space-y-1 text-right text-[11px]">
        {feed.map((f) => (
          <div
            key={f.id}
            className={`rounded bg-black/55 px-2 py-1 backdrop-blur ${f.good ? "text-emerald-300" : "text-amber-300"}`}
          >
            {f.text}
          </div>
        ))}
      </div>

      {/* လက်နက် ခလုတ်များ — ဖုန်းအတွက် */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {Object.entries(weapons).map(([k, w]) => (
          <button
            key={k}
            onClick={() => sendRef.current?.({ type: "aWeapon", weapon: k })}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] backdrop-blur transition ${
              you?.weapon === k ? "bg-emerald-500/70 text-white" : "bg-black/55 text-white/75"
            }`}
          >
            {w.my}
          </button>
        ))}
      </div>
    </div>
  );
}
