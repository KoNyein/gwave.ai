/// FPV drone game modes — sim ရဲ့ free-fly အပေါ် ပွဲစဉ် layer။
///
/// Mode တစ်ခုစီက runtime object တစ်ခု — frame တိုင်း update() ခေါ်ပြီး
/// mission စာသား / ကျန်ချိန် / ရမှတ်ကို HUD ဆီ ပြန်ပို့တယ်။ ပြီးရင်
/// done ကို ပို့ပြီး fpv-sim က results overlay ပြတယ်။
///
/// ★ ပွဲစဉ်တွေက scene ထဲ ကိုယ်ပိုင် object (မီးပုံး၊ pad၊ marker) တွေ
///   ထည့်တယ် — dispose() မှာ ရှင်းပြန်တယ်။

import * as THREE from "three";

import type { FpvMap } from "./maps";

export type FpvGameDef = {
  id: string;
  emoji: string;
  nameMy: string;
  blurbMy: string;
  /// ဒီပွဲ ကစားလို့ရတဲ့ map များ ("all" = အကုန်)
  maps: string[] | "all";
};

export const FPV_GAMES: FpvGameDef[] = [
  { id: "free", emoji: "🕊", nameMy: "Free Fly", blurbMy: "ပွဲစဉ်မရှိ — လွတ်လပ်စွာ လေ့ကျင့်မောင်း", maps: "all" },
  { id: "race", emoji: "🏁", nameMy: "Race — ၃ ပတ်ပြိုင်", blurbMy: "Gate အစဉ်လိုက် ၃ ပတ် — အချိန်တိုဆုံး မှတ်တမ်းတင်", maps: ["race", "canyon", "warehouse"] },
  { id: "rush", emoji: "⏱", nameMy: "Checkpoint Rush", blurbMy: "အချိန်မကုန်ခင် checkpoint တွေ မီအောင်လိုက် — တစ်ခုမီတိုင်း +5s", maps: ["race", "canyon", "warehouse"] },
  { id: "balloon", emoji: "🎈", nameMy: "Balloon Hunt", blurbMy: "၉၀ စက္ကန့်အတွင်း မီးပုံး အများဆုံး ဖောက်ပါ", maps: "all" },
  { id: "strike", emoji: "💥", nameMy: "Strike Mission", blurbMy: "၁၂၀ စက္ကန့် score attack — ပစ်မှတ်ယာဉ်အိုတွေ ထိုးဖျက်", maps: ["range"] },
  { id: "landing", emoji: "🛬", nameMy: "Landing Challenge", blurbMy: "Pad ၅ ခုပေါ် ညင်ညင်သာသာ အဆင့်ဆင့် ဆင်းသက်ပါ", maps: "all" },
];

export function gameAllowsMap(game: FpvGameDef, mapId: string): boolean {
  return game.maps === "all" || game.maps.includes(mapId);
}

export type GameHud = {
  mission: string;
  timeLeft?: number;
  score?: number;
  done?: { title: string; detail: string; score: number };
};

export type GameRuntime = {
  /// Frame တိုင်း — drone အခြေအနေ ပေးပြီး HUD အခြေအနေ ပြန်ရတယ်
  update(dt: number, pos: THREE.Vector3, vel: THREE.Vector3, armed: boolean): GameHud;
  dispose(): void;
};

const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

/// Gate marker — လက်ရှိသွားရမယ့် checkpoint ကို တောက်ပတဲ့ ring နဲ့ ပြတယ်
function makeMarker(scene: THREE.Scene): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.22, 10, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xffc93d,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    }),
  );
  scene.add(m);
  return m;
}

export function createGameRuntime(
  id: string,
  scene: THREE.Scene,
  map: FpvMap,
  explode: (at: THREE.Vector3) => void,
): GameRuntime {
  // ── 🏁 Race — gate အစဉ်လိုက် ၃ ပတ် ─────────────────────────────────
  if (id === "race" && map.gates.length > 0) {
    const LAPS = 3;
    let gate = 0;
    let lap = 0;
    let startAt = 0;
    let bestLap = 0;
    let lapStart = 0;
    let done: GameHud["done"];
    const marker = makeMarker(scene);
    return {
      update(dt, pos) {
        if (done) return { mission: "ပြီးပါပြီ", done };
        const g = map.gates[gate]!;
        marker.position.copy(g.pos);
        marker.rotation.y += dt * 2;
        if (pos.distanceTo(g.pos) < g.radius + 0.6) {
          if (gate === 0) {
            const now = performance.now();
            if (startAt === 0) {
              startAt = now;
              lapStart = now;
            } else {
              const lapMs = now - lapStart;
              if (bestLap === 0 || lapMs < bestLap) bestLap = lapMs;
              lapStart = now;
              lap += 1;
              if (lap >= LAPS) {
                const total = now - startAt;
                done = {
                  title: "🏁 ပြိုင်ပွဲ ပြီးပါပြီ",
                  detail: `စုစုပေါင်း ${fmt(total)} · အကောင်းဆုံး lap ${fmt(bestLap)}`,
                  score: Math.max(1, Math.round(600_000 / total)),
                };
              }
            }
          }
          gate = (gate + 1) % map.gates.length;
        }
        return {
          mission:
            startAt === 0
              ? "Start gate ကို ဖြတ်ပြီး စပါ"
              : `Lap ${lap + 1}/${LAPS} · Gate ${gate + 1}/${map.gates.length}`,
          timeLeft: startAt ? (performance.now() - lapStart) / 1000 : undefined,
          done,
        };
      },
      dispose() {
        scene.remove(marker);
      },
    };
  }

  // ── ⏱ Checkpoint Rush — random gate၊ မီတိုင်း +5s ────────────────────
  if (id === "rush" && map.gates.length > 0) {
    let target = Math.floor(Math.random() * map.gates.length);
    let timeLeft = 40;
    let score = 0;
    let done: GameHud["done"];
    const marker = makeMarker(scene);
    return {
      update(dt, pos, _vel, armed) {
        if (done) return { mission: "ပြီးပါပြီ", done };
        if (armed) timeLeft -= dt;
        if (timeLeft <= 0) {
          done = {
            title: "⏱ အချိန်ကုန်ပါပြီ",
            detail: `Checkpoint ${score} ခု မီခဲ့တယ်`,
            score,
          };
        }
        const g = map.gates[target]!;
        marker.position.copy(g.pos);
        marker.rotation.y += dt * 3;
        if (pos.distanceTo(g.pos) < g.radius + 0.6) {
          score += 1;
          timeLeft = Math.min(60, timeLeft + 5);
          let next = target;
          while (next === target) next = Math.floor(Math.random() * map.gates.length);
          target = next;
        }
        return { mission: `⏱ Checkpoint ကို မီအောင်လိုက်`, timeLeft: Math.max(0, timeLeft), score, done };
      },
      dispose() {
        scene.remove(marker);
      },
    };
  }

  // ── 🎈 Balloon Hunt — ၉၀ စက္ကန့် ────────────────────────────────────
  if (id === "balloon") {
    const balloons: THREE.Mesh[] = [];
    const colors = [0xf06a6a, 0x44e0c0, 0xf5c542, 0xc78bf0, 0x7ea0ff];
    for (let i = 0; i < 20; i++) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 12, 10),
        new THREE.MeshStandardMaterial({
          color: colors[i % colors.length]!,
          emissive: colors[i % colors.length]!,
          emissiveIntensity: 0.3,
          roughness: 0.4,
        }),
      );
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 55;
      b.position.set(Math.cos(a) * r, 4 + Math.random() * 26, Math.sin(a) * r);
      scene.add(b);
      balloons.push(b);
    }
    let timeLeft = 90;
    let score = 0;
    let done: GameHud["done"];
    return {
      update(dt, pos, _vel, armed) {
        if (done) return { mission: "ပြီးပါပြီ", done };
        if (armed) timeLeft -= dt;
        for (const b of balloons) {
          if (!b.visible) continue;
          b.position.y += Math.sin(performance.now() / 700 + b.position.x) * dt * 0.4;
          if (pos.distanceTo(b.position) < 2.1) {
            b.visible = false;
            score += 1;
            explode(b.position.clone());
          }
        }
        if (timeLeft <= 0 || score >= balloons.length) {
          done = {
            title: score >= balloons.length ? "🎈 အကုန် ဖောက်ပြီးပါပြီ!" : "⏱ အချိန်ကုန်ပါပြီ",
            detail: `မီးပုံး ${score}/${balloons.length} ဖောက်ခဲ့တယ်`,
            score,
          };
        }
        return { mission: "🎈 မီးပုံးတွေ ဖောက်ပါ", timeLeft: Math.max(0, timeLeft), score, done };
      },
      dispose() {
        for (const b of balloons) scene.remove(b);
      },
    };
  }

  // ── 💥 Strike Mission — ၁၂၀ စက္ကန့် (range map ရဲ့ targets ကို သုံး) ──
  if (id === "strike" && map.targets.length > 0) {
    let timeLeft = 120;
    let score = 0;
    let prevAlive = map.targets.filter((t) => t.alive).length;
    let done: GameHud["done"];
    return {
      update(dt, _pos, _vel, armed) {
        if (done) return { mission: "ပြီးပါပြီ", done };
        if (armed) timeLeft -= dt;
        // fpv-sim ရဲ့ kamikaze logic က target ကို ဖျက်တယ် — ဒီမှာ ရေတွက်ရုံ
        const alive = map.targets.filter((t) => t.alive).length;
        if (alive < prevAlive) score += prevAlive - alive;
        prevAlive = alive;
        if (timeLeft <= 0) {
          done = { title: "💥 Mission ပြီးပါပြီ", detail: `ပစ်မှတ် ${score} ခု ဖျက်ခဲ့တယ်`, score };
        }
        return { mission: "💥 ပစ်မှတ်ယာဉ်အိုတွေ ထိုးဖျက်ပါ", timeLeft: Math.max(0, timeLeft), score, done };
      },
      dispose() {
        /* scene object မထည့်ထားဘူး */
      },
    };
  }

  // ── 🛬 Landing Challenge — pad ၅ ခု ညင်သာစွာ ဆင်း ───────────────────
  if (id === "landing") {
    const spots: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      const r = 14 + i * 9;
      spots.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const pads = spots.map((p, i) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 0.18, 24),
        new THREE.MeshStandardMaterial({
          color: 0x2f6fb0,
          emissive: 0x2f6fb0,
          emissiveIntensity: i === 0 ? 0.8 : 0.1,
        }),
      );
      pad.position.set(p.x, 0.09, p.z);
      scene.add(pad);
      return pad;
    });
    let idx = 0;
    let score = 0;
    let grounded = false;
    let done: GameHud["done"];
    return {
      update(_dt, pos, vel) {
        if (done) return { mission: "ပြီးပါပြီ", done };
        const target = spots[idx]!;
        const onGround = pos.y < 0.25;
        // မြေထိချိန်တစ်ခါပဲ စစ်တယ် — ထိပြီးနေတုန်း ထပ်မရေတွက်ဘူး
        if (onGround && !grounded) {
          grounded = true;
          const d = Math.hypot(pos.x - target.x, pos.z - target.z);
          const soft = vel.length() < 2.4;
          if (d < 2.4 && soft) {
            score += 1;
            explode(new THREE.Vector3(target.x, 1, target.z));
            const pm = pads[idx]!.material as THREE.MeshStandardMaterial;
            pm.color.set(0x35c26a);
            pm.emissive.set(0x35c26a);
            idx += 1;
            if (idx >= spots.length) {
              done = { title: "🛬 Landing အကုန် အောင်ပါပြီ!", detail: `Pad ${score}/5 အောင်မြင်`, score };
            } else {
              const nm = pads[idx]!.material as THREE.MeshStandardMaterial;
              nm.emissiveIntensity = 0.8;
            }
          }
        }
        if (!onGround) grounded = false;
        return {
          mission: done
            ? "ပြီးပါပြီ"
            : `🛬 Pad ${idx + 1}/5 ပေါ် ညင်သာစွာ ဆင်းပါ (အပြာရောင် တောက်နေတဲ့ pad)`,
          score,
          done,
        };
      },
      dispose() {
        for (const p of pads) scene.remove(p);
      },
    };
  }

  // ── 🕊 Free fly (default) ───────────────────────────────────────────
  return {
    update: () => ({ mission: "" }),
    dispose() {
      /* ဘာမှ မထည့်ထားဘူး */
    },
  };
}
