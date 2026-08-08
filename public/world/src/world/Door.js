// ============================================================
// Door.js — 🚪 **လှပ်ဖွင့်လို့ရတဲ့ တံခါး**
//
// user: "အိမ်တံခါးတွေ လှပ်မရဘူး"
//
// ═══ ဘယ်လို သုံးလဲ ═══
//
//   တံခါးနား သွား → `E` → ပွင့်တယ် (၉၀°) → ဝင်သွား → `E` → ပိတ်တယ်
//
// ═══ ဒီဇိုင်း ═══
//
// ★ **တံခါးရွက်က pivot တစ်ခုမှာ တွဲထား** — pivot က တံခါးဘောင် အနားမှာ
//   ရှိပြီး ရွက်က အလယ်မှာ။ pivot ကို လှည့်လိုက်ရင် တံခါး ပွင့်တယ်၊
//   အနားက မရွေ့ဘူး (တကယ့် ပတ္တာလိုပဲ)。
// ★ **collider က ပိတ်ထားချိန်မှာသာ** ရှိတယ်။ ဖွင့်လိုက်ရင် `colliders`
//   ထဲက ဖြုတ်လိုက်တယ် — physics က AABB array တစ်ခုတည်း သုံးတာမို့
//   ဖြုတ်/ထည့် ရိုးရိုးပါပဲ။
// ★ **အသေးစိတ် မလိုဘူး** — mesh ၂ ခု (ရွက် + လက်ကိုင်), တြိဂံ ~၂၀。
//   အိမ် ၂၀ လုံးမှာ ထားလည်း တြိဂံ ၄၀၀ ပဲ။
// ============================================================

import * as THREE from 'three';

const OPEN_ANGLE = Math.PI / 2 * 0.92;   // ~၈၃° — နံရံနဲ့ မထိအောင်
const SPEED = 4.2;                        // rad/s — ဖွင့်/ပိတ် အမြန်နှုန်း

const panelMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.8 });
const knobMat = new THREE.MeshStandardMaterial({
  color: 0xc9a13b, metalness: 0.8, roughness: 0.3,
});

/**
 * တံခါး တစ်ချပ် ထည့်တယ်။ `room.doors` ထဲ ဝင်သွားပြီး `Room.update` က
 * လှုပ်ရှားမှုကို ကိုင်တယ်၊ main.js က `E` ကို ချိတ်တယ်။
 *
 * @param o.x,o.z   — တံခါးဝ ရဲ့ **အလယ်** (world)
 * @param o.facing  — တံခါး ဘယ်ဘက် မျက်နှာမူလဲ: '+x' | '-x' | '+z' | '-z'
 * @param o.width   — တံခါးဝ အကျယ်
 * @param o.height  — တံခါး အမြင့် (default ၂.၄)
 * @param o.hinge   — ပတ္တာ ဘယ်ဘက်လဲ: +1 | -1 (မတူရင် ဆန့်ကျင်ဘက် ပွင့်တယ်)
 * @param o.label   — HUD မှာ ပြမယ့် စာသား
 */
export function addDoor(room, {
  x = 0, z = 0, facing = '+z', width = 3, height = 2.4, hinge = 1,
  label = '🚪 တံခါး',
} = {}) {
  const axisZ = facing === '+z' || facing === '-z';
  const t = 0.12;                     // တံခါး ထူ

  // ── ပတ္တာ (pivot) — တံခါးဝ ရဲ့ အနားတစ်ဖက် ────────────────────────
  const pivot = new THREE.Group();
  const half = width / 2;
  if (axisZ) pivot.position.set(x + hinge * half, 0, z);
  else pivot.position.set(x, 0, z + hinge * half);
  room.group.add(pivot);

  // ── တံခါးရွက် — pivot ကနေ အလယ်ဘက် ကပ်ထား ─────────────────────
  const panel = new THREE.Mesh(
    axisZ ? new THREE.BoxGeometry(width, height, t)
          : new THREE.BoxGeometry(t, height, width),
    panelMat,
  );
  if (axisZ) panel.position.set(-hinge * half, height / 2, 0);
  else panel.position.set(0, height / 2, -hinge * half);
  pivot.add(panel);

  // လက်ကိုင် — ပတ္တာနဲ့ အဝေးဆုံး အနားမှာ
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), knobMat);
  if (axisZ) knob.position.set(-hinge * (width - 0.35), height * 0.45, t);
  else knob.position.set(t, height * 0.45, -hinge * (width - 0.35));
  pivot.add(knob);

  // ── ပိတ်ထားချိန် collider — တံခါးဝ ကို ဖုံးတယ် ───────────────────
  const box = axisZ
    ? new THREE.Box3(new THREE.Vector3(x - half, 0, z - t),
                     new THREE.Vector3(x + half, height, z + t))
    : new THREE.Box3(new THREE.Vector3(x - t, 0, z - half),
                     new THREE.Vector3(x + t, height, z + half));
  room.colliders.push(box);

  const door = {
    pivot, panel, box, label,
    position: new THREE.Vector3(x, 0, z),
    open: false,
    angle: 0,
    // ဘယ်ဘက်ကို ပွင့်မလဲ — အထဲဘက် ပွင့်တယ် (လမ်းပေါ် မထွက်စေရ)
    target: 0,
    dir: (facing === '+z' || facing === '-x') ? -hinge : hinge,
  };
  (room.doors ||= []).push(door);
  return door;
}

/// တံခါး ဖွင့်/ပိတ် — collider ကိုပါ လိုက်ပြင်တယ်
export function toggleDoor(room, door, sfx) {
  door.open = !door.open;
  door.target = door.open ? OPEN_ANGLE * door.dir : 0;

  const list = room.colliders;
  const i = list.indexOf(door.box);
  if (door.open) {
    // ပွင့်တယ် — တားတာ ဖယ်
    if (i >= 0) list.splice(i, 1);
  } else if (i < 0) {
    // ပိတ်တယ် — ပြန်တား
    list.push(door.box);
  }
  sfx?.ui({ up: door.open });
  return door.open;
}

/// frame တိုင်း — တံခါးတွေ ဖြည်းဖြည်း လှည့်တယ် (Room.update က ခေါ်)
export function updateDoors(room, dt) {
  const doors = room.doors;
  if (!doors) return;
  for (const d of doors) {
    if (Math.abs(d.angle - d.target) < 0.005) continue;
    const step = SPEED * dt;
    d.angle += Math.max(-step, Math.min(step, d.target - d.angle));
    d.pivot.rotation.y = d.angle;
  }
}

/// ကစားသမားနဲ့ အနီးဆုံး တံခါး
///
/// ★ **အလျားလိုက် အကွာအဝေးကိုသာ** တိုင်းတယ်။ ခြေတံရှည်အိမ်တွေမှာ
///   တံခါးက ကြမ်းပြင် (y=step) မှာ ရှိပြီး ကစားသမားက မြေပြင်မှာ ဆိုတော့
///   ၃-ဖက် အကွာအဝေး သုံးရင် တံခါးနား ရောက်နေတောင် မမိဘူး။
export function nearestDoor(room, pos, maxDist = 2.6) {
  const doors = room?.doors;
  if (!doors) return null;
  let best = null, bestD = maxDist;
  for (const d of doors) {
    if (Math.abs(d.position.y - pos.y) > 3) continue;   // အောက်/အထက် ထပ် မမှားစေရ
    const dist = Math.hypot(d.position.x - pos.x, d.position.z - pos.z);
    if (dist < bestD) { best = d; bestD = dist; }
  }
  return best;
}
