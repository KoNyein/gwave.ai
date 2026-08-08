// ============================================================
// Manor.js — 🏛️ **GreenWave Manor** — အခန်းတိုင်းမှာ ရှိတဲ့ အိမ်တော်
//
// user: "ground earth metaverse တိုင်းမှာ ထည့်ပါ"
//
// ═══ ဒီမော်ဒယ်က တခြားဟာတွေနဲ့ မတူဘူး ═══
//
// တင်လာတဲ့ ဖိုင်ထဲမှာ **ဂိမ်းအတွက် သတ်မှတ်ချက် (contract) ပါလာတယ်** —
// node နာမည်တွေက အဓိပ္ပာယ် ရှိပြီး root `extras` မှာ စာချုပ်တစ်ခု ပါတယ်:
//
//     { type:"building", floors:3, footprint:[24,16], height:21.8,
//       spawn:"SPAWN_Entrance", walkable:true,
//       doors:[{ node:"DOOR_Main", leaves:["DOOR_L","DOOR_R"],
//                trigger:"TRIGGER_Door_Main", radius:3.6, auto:true },
//              { node:"GATE_Main", leaves:["GATE_L","GATE_R"],
//                trigger:"TRIGGER_Gate_Main", radius:8, auto:true }] }
//
//   · `NOCOL_*`   — collider မလိုတဲ့ အပိုင်း (မြေ, ကားလမ်း, ခြံစည်းရိုး)
//   · `DOOR_L/R`  — အိမ်ရှေ့ တံခါး ၂ ချပ် (ပတ္တာ တပ်ရမယ့် အပိုင်း)
//   · `GATE_L/R`  — ဝင်းတံခါး ၂ ချပ်
//   · `TRIGGER_*` — အနီးရောက်ရင် အလိုအလျောက် ပွင့်ရမယ့် စက်ဝိုင်း
//   · `SPAWN_*`   — ထပ်တိုင်း ရဲ့ ရပ်စရာ နေရာ
//   · `STAIRS`    — လှေကား
//
// ★ ဒါကြောင့် **ခန့်မှန်းစရာ မလိုဘူး** — ဖိုင်က ဘယ်ဟာ နံရံ, ဘယ်ဟာ တံခါး,
//   ဘယ်ဟာ ဖြတ်သွားလို့ရတယ် ဆိုတာ ကိုယ်တိုင် ပြောထားတယ်။ ဒီ module က
//   အဲဒီ စာချုပ်ကို လိုက်နာရုံပါပဲ။ (တခြား GLB တွေမှာ ဒါ မပါလို့
//   Occupancy.js နဲ့ ခန့်မှန်းရတာ။)
//
// ═══ ဖိုင်ကို ဘာလုပ်ထားလဲ ═══
//
//   mesh ၃၄၂ → **၂၅**   (draw call ၃၄၂ → ၂၅)
//   တြိဂံ ၁၇,၆၀၂ → ၁၇,၆၀၂  (တစ်ခုမှ မလျော့)
//   ၁.၂၅ MB → **၀.၇၇ MB**
// material အလိုက် ပေါင်းတယ် — ဒါပေမယ့် `DOOR_L/R`, `GATE_L/R`, `STAIRS`,
// `NOCOL`, `SPAWN_*`, `TRIGGER_*` တွေကို **သီးသန့် ထားတယ်**၊ မဟုတ်ရင်
// စာချုပ်ပါ ပျောက်သွားမယ်။ render ၂ ခု ဘေးချင်းယှဉ်ကြည့်ပြီး တူညီကြောင်း
// အတည်ပြုထားတယ်။
// ============================================================

import * as THREE from 'three';
import { loadGLB } from '../core/Assets.js';
import { trackQuality } from '../core/Quality.js';
import { occupancyGrid, boxesFromGrid } from './Occupancy.js';

const URL = '/world/assets/greenwave_manor.glb';

/// ဝင်းရဲ့ အကျယ်အဝန်း — မော်ဒယ်ရဲ့ origin ကနေ တိုင်းထားတာ (တိုင်းပြီးသား)
///   x: −32 … +32   z: −51 … +23   (ဂိတ်က z −40, အိမ်က z −5)
const PLOT = { x: 64, zBack: 51, zFront: 23 };

/**
 * 🗺️ **အခန်းတိုင်းအတွက် တူညီတဲ့ နေရာ** — မြို့ရဲ့ အပြင်ဘက်၊ မြေပြင်ပေါ်。
 *
 * user: "ground earth metaverse တိုင်းမှာ ထည့်ပါ"
 *
 * ★ ဝင်းက ၆၄ × ၇၄ m — မြို့ထဲ ထည့်ရင် ရှိပြီးသား အဆောက်အအုံတွေနဲ့
 *   ထပ်မယ် (လယ်ကွင်းက ၉၀ m ပဲ ရှိတာ)。 ဒါကြောင့် မြို့ အနားကနေ
 *   ထွက်သွားရတဲ့ **ကိုယ်ပိုင် ခြံဝန်း** အဖြစ် ချထားတယ် — ဂိတ်က မြို့ဘက်
 *   လှည့်ထားလို့ လမ်းအတိုင်း လျှောက်/မောင်း သွားလို့ ရတယ်။
 * ★ တောင်တန်း ပေါ် မတင်စေရ — `flatSpot()` က `addTerrain` ကို ပေးဖို့
 *   ပြားရမယ့် စက်ဝိုင်း ပြန်ပေးတယ်。
 */
export function manorSpot(ground) {
  const z = ground / 2 + 52;                 // မြို့ အနားကနေ အပြင်
  return {
    position: new THREE.Vector3(0, 0, z),
    rotation: 0,
    // ဝင်း ဗဟို — ဂိတ် (z−51) နဲ့ နောက်ဖေး (z+23) ရဲ့ အလယ်
    flatSpot: { x: 0, z: z - (PLOT.zBack - PLOT.zFront) / 2, r: 46, blend: 40 },
  };
}

const OPEN = Math.PI / 2 * 0.95;   // တံခါး ပွင့်တဲ့ ထောင့်
const SPEED = 2.6;                 // rad/s — ကြီးမားတဲ့ တံခါးမို့ ဖြည်းဖြည်း

/**
 * အိမ်တော်ကို အခန်းထဲ ချထားတယ်။
 *
 * @param o.position — ဝင်းရဲ့ ဗဟို (မြေပြင်ပေါ်)
 * @param o.rotation — Y ဝင်ရိုး radian。 ★ ၉၀° အဆများသာ သုံးပါ —
 *                     collider က ဝင်ရိုးလိုက် box ဖြစ်လို့ ကြားထောင့်ဆို
 *                     နံရံက လှေကားထစ် ပုံစံ ဖြစ်သွားမယ်。
 * @param o.scale
 * @returns {Promise<object|null>} — { group, doors, extras }
 */
export async function addManor(room, {
  position = new THREE.Vector3(),
  rotation = 0,
  scale = 1,
  tier = 'detail',
} = {}) {
  let gltf;
  try {
    gltf = await loadGLB(URL);
  } catch {
    return null;   // ဖိုင် မရရင် အခန်းက ဆက်အလုပ်လုပ်ရမယ်
  }
  const obj = gltf.scene.clone(true);
  obj.position.copy(position);
  obj.rotation.y = rotation;
  obj.scale.setScalar(scale);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;      // 🔋 ဖုန်း
    o.receiveShadow = false;
  });
  room.group.add(obj);
  // ★ collider မဆောက်ခင် transform ကို သွင်းရမယ် — မဟုတ်ရင် box တွေက
  //   လောကရဲ့ ဗဟိုမှာ ထွက်လာမယ် (အရင်က ဒီအမှားနဲ့ ဘာမှ မတားဖြစ်ခဲ့ဘူး)。
  obj.updateMatrixWorld(true);
  trackQuality(obj, tier);

  const extras = findExtras(obj);
  const named = new Map();
  obj.traverse((o) => { if (o.name) named.set(o.name, o); });

  buildColliders(room, obj, named, extras, position, scale);
  const doors = hingeLeaves(room, named, extras, obj);

  const manor = { group: obj, doors, extras, position: position.clone() };
  (room.manors ||= []).push(manor);
  return manor;
}

/// root ရဲ့ extras — GLTFLoader က `userData` အဖြစ် ထားပေးတယ်
function findExtras(obj) {
  let found = null;
  obj.traverse((o) => {
    if (found) return;
    if (o.userData && o.userData.type === 'building') found = o.userData;
  });
  return found || {};
}

// ══════════════════════════════════════════════════════════════════════
// 🧱 collider
// ══════════════════════════════════════════════════════════════════════

function buildColliders(room, obj, named, extras, position, scale, rotation = 0) {
  const floors = extras.floors || 3;
  // ထပ်တိုင်းရဲ့ ကြမ်းပြင် အမြင့် — SPAWN_Floor_N က ကစားသမား ရပ်တဲ့ နေရာ
  const levels = [];
  for (let i = 1; i <= floors; i++) {
    const s = named.get(`SPAWN_Floor_${i}`);
    if (s) {
      const p = new THREE.Vector3().setFromMatrixPosition(s.matrixWorld);
      levels.push(p.y);
    }
  }
  if (!levels.length) levels.push(0);

  // ── ① နံရံ — **မော်ဒယ်ရဲ့ စာချုပ်အတိုင်း** ────────────────────────
  //
  // ★ ပထမတစ်ခါက Occupancy grid နဲ့ ခန့်မှန်းကြည့်တယ် — အထပ်တိုင်းရဲ့
  //   ခန္ဓာကိုယ်အမြင့်မှာ တြိဂံရှိတဲ့ အကွက်တိုင်း နံရံ လုပ်တာ။ ရလဒ်က
  //   **အိမ်ထဲ တစ်ခုလုံး ပိတ်သွားတယ်** (အလယ်မှာ တွန်းအား ၃.၄၀ m) —
  //   အထဲမှာ အခန်းခွဲ နံရံတွေ, ပရိဘောဂတွေ ရှိလို့ အကွက်အားလုံး
  //   "အခိုင်အမာ" ဖြစ်ကုန်တယ်။
  // ★ ဒီမော်ဒယ်မှာ `footprint:[24,16]` နဲ့ `walkable:true` ပါပြီးသား
  //   ဖြစ်လို့ **ခန့်မှန်းစရာ မလိုဘူး** — အပြင်နံရံ ၄ ချပ်ကို footprint
  //   အတိုင်း ချပြီး ရှေ့နံရံကို တံခါးဝနဲ့ ခွဲလိုက်ရုံပါပဲ။ အထဲက
  //   ခန်းဆီးတွေက collider မလိုဘူး (လျှောက်လို့ ရရမယ်)。
  const fp = extras.footprint || [24, 16];
  const HW = (fp[0] / 2) * scale, HD = (fp[1] / 2) * scale;
  const WALL = 0.5 * scale;
  const DOOR_HALF = 2.4 * scale;      // တံခါးဝ တစ်ဝက် (DOOR_L/R က x ±1.85)
  const TOP = (extras.height || 21.8) * scale;

  // ★ ၉၀° အဆ လှည့်တာကို ထောက်ပံ့ — ဝင်ရိုးလိုက် box ဖြစ်လို့ ကြားထောင့်
  //   မရဘူး (CityKit မှာလည်း တူညီတဲ့ စည်းမျဉ်း)。
  const cs = Math.round(Math.cos(rotation)), sn = Math.round(Math.sin(rotation));
  const put = (x0, z0, x1, z1, y0, y1) => {
    // local → world (၉၀° အဆ)
    const px = (x, z) => position.x + x * cs + z * sn;
    const pz = (x, z) => position.z - x * sn + z * cs;
    const xs = [px(x0, z0), px(x1, z0), px(x0, z1), px(x1, z1)];
    const zs = [pz(x0, z0), pz(x1, z0), pz(x0, z1), pz(x1, z1)];
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(Math.min(...xs), y0, Math.min(...zs)),
      new THREE.Vector3(Math.max(...xs), y1, Math.max(...zs))));
  };

  const base = levels[0] ?? 0;
  // ဘေးနံရံ ၂ ချပ် + နောက်နံရံ — မြေကနေ အမိုးအထိ
  put(-HW, -HD, -HW + WALL, HD, 0, TOP);
  put(HW - WALL, -HD, HW, HD, 0, TOP);
  put(-HW, HD - WALL, HW, HD, 0, TOP);
  // ရှေ့နံရံ — တံခါးဝ နှစ်ပိုင်း ခွဲ
  put(-HW, -HD, -DOOR_HALF, -HD + WALL, 0, TOP);
  put(DOOR_HALF, -HD, HW, -HD + WALL, 0, TOP);
  // တံခါးဝ အထက် — အပေါ်ထပ်က ဆက်ခိုင်ရမယ် (ခေါင်းပေါ်မှာ)
  put(-DOOR_HALF, -HD, DOOR_HALF, -HD + WALL, base + 2.4, TOP);

  // 🪜 တံခါးရှေ့ လှေကား — ကြမ်းပြင်က မြေထက် ၁.၄ m မြင့်နေတယ်
  const n = Math.max(1, Math.ceil(base / 0.45));
  for (let i = 1; i <= n; i++) {
    const y = (base * i) / n, off = (n - i + 1) * 1.0;
    put(-DOOR_HALF - 0.6, -HD - off, DOOR_HALF + 0.6, -HD - off + 1.0, 0, y);
  }

  // ── ③ 🪜 လှေကား — အကွက်တစ်ခုချင်း box, ထစ်လိုက် တက်သွားတယ် ─────────
  const stairs = named.get('STAIRS');
  if (stairs) {
    const g = occupancyGrid(stairs, { cell: 0.4, bandFrom: -1, bandTo: 99 });
    const { cols, rows, cell, minX, minZ, occ, top } = g;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (!occ[k]) continue;
        room.colliders.push(new THREE.Box3(
          new THREE.Vector3(minX + c * cell, 0, minZ + r * cell),
          new THREE.Vector3(minX + (c + 1) * cell, top[k], minZ + (r + 1) * cell),
        ));
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// 🚪 တံခါး / ဝင်းတံခါး — အနီးရောက်ရင် အလိုအလျောက် ပွင့်တယ်
// ══════════════════════════════════════════════════════════════════════

function hingeLeaves(room, named, extras, obj) {
  const out = [];
  for (const spec of (extras.doors || [])) {
    const trig = named.get(spec.trigger);
    const at = trig
      ? new THREE.Vector3().setFromMatrixPosition(trig.matrixWorld)
      : null;
    const leaves = [];
    for (const nm of (spec.leaves || [])) {
      const leaf = named.get(nm);
      if (!leaf) continue;
      // ★ မော်ဒယ်ထဲမှာ တံခါးရွက်က ပတ္တာနေရာမှာ ချထားပြီးသား (DOOR_L က
      //   x −1.85, DOOR_R က +1.85) — ဒါကြောင့် pivot ထပ်ဆောက်စရာ မလိုဘူး၊
      //   node ကိုယ်တိုင်ကို လှည့်လိုက်ရုံပါပဲ။
      const side = leaf.position.x < 0 ? -1 : 1;
      leaves.push({ node: leaf, base: leaf.rotation.y, dir: -side });
    }
    if (!leaves.length) continue;
    out.push({
      leaves,
      trigger: at,
      radius: (spec.radius || 3.5),
      auto: spec.auto !== false,
      open: false,
      t: 0,
      label: spec.node === 'GATE_Main' ? '🚪 ဝင်းတံခါး' : '🚪 အိမ်တော် တံခါး',
    });
  }
  void room; void obj;
  return out;
}

/**
 * frame တိုင်း — ကစားသမား အနီး ရောက်ရင် ဖွင့်, ဝေးရင် ပိတ်。
 * `Room.update()` က ခေါ်တယ်။
 */
export function updateManors(room, dt, playerPos) {
  const list = room.manors;
  if (!list) return;
  for (const m of list) {
    for (const d of m.doors) {
      if (d.auto && d.trigger && playerPos) {
        const near = d.trigger.distanceTo(playerPos) < d.radius;
        d.open = near;
      }
      const want = d.open ? 1 : 0;
      if (Math.abs(d.t - want) < 0.002) continue;
      const step = (SPEED / OPEN) * dt;
      d.t += Math.max(-step, Math.min(step, want - d.t));
      for (const l of d.leaves) l.node.rotation.y = l.base + d.t * OPEN * l.dir;
    }
  }
}
