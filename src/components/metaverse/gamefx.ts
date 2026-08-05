import * as THREE from "three";

import type { GameObjective } from "./net";

/// Mini-game ရဲ့ မြင်ကွင်း (Phase 16)。
///
/// ★ ဒီ file မှာ **game logic လုံးဝ မရှိဘူး** — အမှတ်၊ ဘယ်သူနိုင်၊ ပစ်ချက်
///   ထိမထိ အားလုံး server မှာ (games.js)。 ဒီမှာက server ပြောတဲ့နေရာကို
///   ပြရုံပဲ။ Client မှာ တွက်လိုက်ရင် devtools ဖွင့်ပြီး ပြင်လို့ရသွားမယ်။
/// ★ Marker တွေကို pool နဲ့ ပြန်သုံးတယ် — 2Hz မှာ mesh အသစ် ဆောက်/ဖျက်ရင်
///   GC က frame ကို ခုန်စေတယ်။

const COLORS: Record<GameObjective["kind"], number> = {
  checkpoint: 0x44bba4,
  item: 0xf6ae2d,
  target: 0xe94f37,
  plant: 0x6cc551,
};

/// Marker အများဆုံး — server က ဒီထက် မပို့ဘူး ဒါပေမယ့် ကာထားတယ်
const MAX_MARKERS = 24;

export type GameFx = {
  /// Server ရဲ့ `gameObjectives` ကို ပြတယ်
  setObjectives(list: GameObjective[]): void;
  /// ပွဲ စတဲ့အခါ ကွင်းအဝိုင်း ပြတယ် (null = ဖျောက်)
  setArena(arena: { x: number; z: number; radius: number } | null): void;
  update(t: number): void;
  dispose(): void;
};

export function createGameFx(scene: THREE.Scene): GameFx {
  const group = new THREE.Group();
  group.name = "gamefx";
  scene.add(group);

  // ── Marker pool ──────────────────────────────────────────────────────────
  // ★ Geometry/Material ကို တစ်ခုတည်း မျှသုံးလို့မရဘူး — အရောင် တစ်ခုချင်း
  // ကွဲလို့။ ဒါပေမယ့် geometry ကတော့ မျှသုံးလို့ရတယ်။
  // ★ ကြီးကြီး၊ တောက်တောက် ဖြစ်ရမယ် — ပထမအကြိမ် စမ်းတုန်းက ပါးလွှာလွန်းလို့
  // ညအချိန်မှာ ဘာမှ မမြင်ရဘူး၊ "ဘယ်ကို သွားရမလဲ" မသိတဲ့ ပွဲက ပွဲမဟုတ်ဘူး။
  const beamGeo = new THREE.CylinderGeometry(0.55, 0.55, 14, 10, 1, true);
  const ringGeo = new THREE.RingGeometry(1.6, 2.3, 28);

  type Marker = {
    root: THREE.Group;
    beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
    ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  };

  const pool: Marker[] = [];
  for (let i = 0; i < MAX_MARKERS; i++) {
    const root = new THREE.Group();
    root.visible = false;

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      // ★ နှစ်ဘက်စလုံး ဆွဲရမယ် — ဗလာပိုက်ဖြစ်လို့ တစ်ဘက်ပဲဆွဲရင်
      // အထဲကနေ ကြည့်တဲ့အခါ ပျောက်သွားမယ်
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 7;

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;

    root.add(beam, ring);
    group.add(root);
    pool.push({ root, beam, ring });
  }

  // ── ကွင်းအဝိုင်း ──────────────────────────────────────────────────────────
  const arenaGeo = new THREE.RingGeometry(0.94, 1, 64);
  const arenaMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const arenaMesh = new THREE.Mesh(arenaGeo, arenaMat);
  arenaMesh.rotation.x = -Math.PI / 2;
  arenaMesh.position.y = 0.05;
  arenaMesh.visible = false;
  group.add(arenaMesh);

  let active = 0;

  return {
    setObjectives(list) {
      active = Math.min(list.length, MAX_MARKERS);
      for (let i = 0; i < MAX_MARKERS; i++) {
        const m = pool[i];
        if (!m) continue;
        const o = i < active ? list[i] : undefined;
        if (!o) {
          m.root.visible = false;
          continue;
        }
        m.root.visible = true;
        m.root.position.set(o.x, 0, o.z);
        // ★ y ပါရင် (drone race ရဲ့ ကောင်းကင် ring) ring ကို အဲဒီအမြင့်မှာ
        // ထားတယ် — pool ပြန်သုံးလို့ မပါရင်လည်း မြေပြင် ပြန်ချရမယ်။
        m.ring.position.y = (o.y ?? 0) + 0.06;
        const color = COLORS[o.kind] ?? 0xffffff;
        m.beam.material.color.setHex(color);
        m.ring.material.color.setHex(color);
        // ★ အပင်က ကြီးလာတာနဲ့အမျှ ကွင်းက ကျယ်လာတယ် — server က ပို့တဲ့
        // `grown` ကို မြင်သာအောင် ပြတာ (client က ဘာမှ မတွက်ဘူး)。
        const s = o.kind === "plant" ? 0.5 + (o.grown ?? 0) : 1;
        m.ring.scale.setScalar(s);
        m.beam.visible = o.kind !== "plant";
      }
    },

    setArena(arena) {
      if (!arena) {
        arenaMesh.visible = false;
        return;
      }
      arenaMesh.visible = true;
      arenaMesh.position.set(arena.x, 0.05, arena.z);
      arenaMesh.scale.setScalar(arena.radius);
    },

    update(t) {
      // ရိုးရှင်းတဲ့ တုန်ခါမှု — ကြည့်ရတာ ရှင်သန်နေတယ်လို့ ခံစားရဖို့
      const pulse = 0.75 + Math.sin(t * 3) * 0.22;
      for (let i = 0; i < active; i++) {
        const m = pool[i];
        if (!m || !m.root.visible) continue;
        m.ring.material.opacity = pulse;
        m.beam.material.opacity = pulse * 0.5;
        m.root.rotation.y = t * 0.6;
      }
    },

    dispose() {
      // ★ WebGL resource က GC မလုပ်ဘူး — dispose မလုပ်ရင် map ပြောင်းတိုင်း
      // GPU memory တက်သွားမယ်။
      for (const m of pool) {
        m.beam.material.dispose();
        m.ring.material.dispose();
      }
      beamGeo.dispose();
      ringGeo.dispose();
      arenaGeo.dispose();
      arenaMat.dispose();
      scene.remove(group);
    },
  };
}
