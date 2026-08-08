// ============================================================
// Occupancy.js — 🧱 **မော်ဒယ်ရဲ့ တကယ့် ပုံသဏ္ဌာန်ကနေ collider ထုတ်**
//
// user: "အိမ်တွေကို object တွေကို avatar မှ ဖောက်ထွင်း သွားလာလို့ မရအောင်"
//
// ═══ ဘာကြောင့် ဒါ လိုလဲ ═══
//
// အရင်က GLB အိမ်တွေရဲ့ collider ကို **bounding box** ကနေ ဆောက်တယ် —
// အခွံ ၄ ဘက်ကို box ရဲ့ အနားမှာ ချထားတယ်။ ဒါက မော်ဒယ်ရဲ့ နံရံ တကယ်
// ရှိတဲ့နေရာနဲ့ **ကိုက်ချင်မှ ကိုက်တယ်**。
//
// တိုင်းတာချက် (မြဝတီ ခြေတံရှည်အိမ်):
//     မော်ဒယ် bounding box   x[-50.0, -29.9]   (၂၀ m)
//     နံရံ (timber) တကယ်     x[-44.1, -31.9]   (၁၂ m)
//     → collider နံရံက အစစ်ကနေ **၅.၉ m အပြင်မှာ** ချထားမိတယ်။
//       ဆိုလိုတာက အိမ်ရဲ့ နံရံအစစ်ကို လုံးဝ ဖြတ်လျှောက်လို့ ရနေတယ်။
//
// ═══ ဒီ module က ဘယ်လို ဖြေရှင်းလဲ ═══
//
// ★ မော်ဒယ်ရဲ့ **တြိဂံတွေကို တိုက်ရိုက် ဖတ်ပြီး** ဇယားကွက် (grid) ပေါ်
//   ပုံနှိပ်တယ်။ ခန္ဓာကိုယ် အမြင့် (band) ကို ဖြတ်တဲ့ တြိဂံရှိတဲ့ အကွက်
//   တိုင်း = နံရံ။ မရှိတဲ့ အကွက် = ဖြတ်သွားလို့ရ (တံခါးဝ, ပြတင်းပေါက်
//   အောက်, အခန်းအလွတ်)。
// ★ ပြီးရင် အကွက်တွေကို **အတန်းလိုက် ပေါင်း**ပြီး Box3 အနည်းဆုံး
//   အရေအတွက် ထုတ်တယ် — physics က box တစ်ခုချင်း စစ်တာမို့ ၄၀၀ အစား
//   ၂၀ ဆိုရင် ၂၀ ဆ မြန်တယ်။
// ★ **တံခါးဝကို ကိုယ်တိုင် ရှာတယ်** — ပေးထားတဲ့ ဘက်ရဲ့ နံရံတန်းမှာ
//   အကွက်လွတ် အရှည်ဆုံး အတန်း = တံခါးဝ။ မော်ဒယ် အသစ် တင်လိုက်တိုင်း
//   တံခါး ဘယ်မှာလဲ ကိုယ်တိုင် ရှာပေးတယ်၊ လက်နဲ့ ရေးစရာ မလိုဘူး။
//
// 🔋 ကုန်ကျစရိတ် — တြိဂံ တစ်ခေါက်စာ ဖတ်ရုံပဲ (ခြေတံရှည်အိမ် ၉,၇၅၂၊
//    ကိုလိုနီအိမ် ၁၅,၁၆၀)。 အခန်း ဆောက်ချိန်မှာ တစ်ခါတည်း၊ frame တိုင်း
//    မဟုတ်ဘူး。
// ============================================================

import * as THREE from 'three';

/**
 * မော်ဒယ်ရဲ့ တြိဂံတွေကို XZ ဇယားကွက် ပေါ် ပုံနှိပ်တယ်။
 *
 * @param {THREE.Object3D} object — world matrix update ပြီးသား ဖြစ်ရမယ်
 * @param o.cell     — အကွက် အရွယ် (m)。 သေးလေ တိကျလေ, box များလေ
 * @param o.bandFrom — ဒီအမြင့်ကနေ
 * @param o.bandTo   — ဒီအမြင့်အထိ ဖြတ်တဲ့ တြိဂံတွေကိုပဲ ရေတွက်
 * @returns grid — { cols, rows, cell, minX, minZ, occ:Uint8Array, top:Float32Array }
 */
export function occupancyGrid(object, { cell = 0.5, bandFrom = 0.6, bandTo = 1.8 } = {}) {
  const box = new THREE.Box3().setFromObject(object);
  const minX = box.min.x, minZ = box.min.z;
  const cols = Math.max(1, Math.ceil((box.max.x - minX) / cell));
  const rows = Math.max(1, Math.ceil((box.max.z - minZ) / cell));
  const occ = new Uint8Array(cols * rows);
  const top = new Float32Array(cols * rows);

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

  object.updateMatrixWorld(true);
  object.traverse((m) => {
    if (!m.isMesh) return;
    const geo = m.geometry;
    const p = geo?.attributes?.position;
    if (!p) return;
    const idx = geo.index;
    const n = idx ? idx.count : p.count;
    const mat4 = m.matrixWorld;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(p, i0).applyMatrix4(mat4);
      b.fromBufferAttribute(p, i1).applyMatrix4(mat4);
      c.fromBufferAttribute(p, i2).applyMatrix4(mat4);

      const yLo = Math.min(a.y, b.y, c.y), yHi = Math.max(a.y, b.y, c.y);
      // ★ အမြင့်ကို **အမြဲ** မှတ်တယ် — collider က မြေကနေ အမိုးအထိ
      //   မြင့်ရမယ်၊ band ထဲက တြိဂံချည်း ကြည့်ရင် နံရံက ပုပြတ်နေမယ်။
      const inBand = yHi >= bandFrom && yLo <= bandTo;

      const tMinX = Math.min(a.x, b.x, c.x), tMaxX = Math.max(a.x, b.x, c.x);
      const tMinZ = Math.min(a.z, b.z, c.z), tMaxZ = Math.max(a.z, b.z, c.z);
      const c0 = Math.max(0, Math.floor((tMinX - minX) / cell));
      const c1 = Math.min(cols - 1, Math.floor((tMaxX - minX) / cell));
      const r0 = Math.max(0, Math.floor((tMinZ - minZ) / cell));
      const r1 = Math.min(rows - 1, Math.floor((tMaxZ - minZ) / cell));

      for (let r = r0; r <= r1; r++) {
        for (let cc = c0; cc <= c1; cc++) {
          const x0 = minX + cc * cell, z0 = minZ + r * cell;
          if (!triHitsCell(a, b, c, x0, z0, x0 + cell, z0 + cell)) continue;
          const k = r * cols + cc;
          if (yHi > top[k]) top[k] = yHi;
          if (inBand) occ[k] = 1;
        }
      }
    }
  });

  return { cols, rows, cell, minX, minZ, occ, top, box };
}

/// တြိဂံ (XZ ပေါ် ချထား) နဲ့ အကွက် (axis-aligned) ထိလား — 2D SAT
/// ★ AABB ချင်း ထိရုံနဲ့ မယူဘူး — အမိုးလို တြိဂံကြီးတွေက ဇယားကွက်
///   တစ်ဝက်လုံးကို အခိုင်အမာ ဖြစ်သွားစေမယ်။
function triHitsCell(a, b, c, x0, z0, x1, z1) {
  // ① အကွက်ရဲ့ ဝင်ရိုး ၂ ခု — တြိဂံရဲ့ AABB နဲ့ ခွဲလို့ရလား
  if (Math.max(a.x, b.x, c.x) < x0 || Math.min(a.x, b.x, c.x) > x1) return false;
  if (Math.max(a.z, b.z, c.z) < z0 || Math.min(a.z, b.z, c.z) > z1) return false;
  // ② တြိဂံရဲ့ အနား ၃ ခုကို ဝင်ရိုးအဖြစ် သုံး
  const vx = [a.x, b.x, c.x], vz = [a.z, b.z, c.z];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const ex = vx[j] - vx[i], ez = vz[j] - vz[i];
    // အနားရဲ့ ထောင့်မတ် (normal) — (-ez, ex)
    const nx = -ez, nz = ex;
    let tMin = Infinity, tMax = -Infinity;
    for (let k = 0; k < 3; k++) {
      const d = nx * vx[k] + nz * vz[k];
      if (d < tMin) tMin = d;
      if (d > tMax) tMax = d;
    }
    let bMin = Infinity, bMax = -Infinity;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const d = nx * px + nz * pz;
      if (d < bMin) bMin = d;
      if (d > bMax) bMax = d;
    }
    if (tMax < bMin || bMax < tMin) return false;
  }
  return true;
}

/**
 * ဇယားကွက်ကနေ Box3 စာရင်း — အတန်းလိုက် ပေါင်းပြီး အရေအတွက် လျှော့တယ်။
 *
 * @param o.floorY — box တွေရဲ့ အောက်ခြေ (ခြေတံရှည်အိမ်ဆိုရင် ကြမ်းပြင်)
 * @param o.minTop — အနည်းဆုံး အမြင့် (ဒီအောက် နိမ့်ရင် ကျော်လွှားလို့ရလို့ ချန်)
 */
export function boxesFromGrid(grid, { floorY = 0, minTop = 1.1 } = {}) {
  const { cols, rows, cell, minX, minZ, occ, top } = grid;
  const out = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (!occ[r * cols + c]) { c++; continue; }
      // ★ အတန်းတစ်ခုတည်းမှာ ဆက်တိုက် ရှိတဲ့ အကွက်တွေကို box တစ်ခုတည်း
      //   အဖြစ် ပေါင်း — ခြေတံရှည်အိမ် တစ်လုံးမှာ ၂၄၀ အစား ၂၈ box。
      let end = c, hi = 0;
      while (end < cols && occ[r * cols + end]) {
        const t = top[r * cols + end];
        if (t > hi) hi = t;
        end++;
      }
      if (hi - floorY >= minTop) {
        out.push(new THREE.Box3(
          new THREE.Vector3(minX + c * cell, floorY, minZ + r * cell),
          new THREE.Vector3(minX + end * cell, hi, minZ + (r + 1) * cell),
        ));
      }
      c = end;
    }
  }
  return out;
}

/**
 * 🚪 **တံခါးဝ ဖောက်တယ်** — မော်ဒယ်မှာ အပေါက် မရှိရင် ကိုယ်တိုင် ဖောက်ပေးတယ်။
 *
 * ★ ဒါ မလိုဘူးလို့ ထင်ခဲ့တယ် — "အပေါက်ရှိတဲ့နေရာ ရှာပြီး တံခါး ချရုံပဲ"
 *   လို့။ ဇယားကွက် ပုံနှိပ်ကြည့်တော့ မဟုတ်ဘူး: ခြေတံရှည်အိမ်ရဲ့ ရှေ့နံရံက
 *   **တစ်ခုလုံး အခိုင်အမာ** (ပုံထဲမှာ တစ်တန်းလုံး `#`)。 မော်ဒယ်မှာ
 *   တံခါးရွက် ပိတ်ထားတာ ပါလာလို့။ အရင်က bounding-box အခွံက ၄ m အပေါက်
 *   အတုကြီး ပေးထားလို့ ဝင်လို့ ရနေတာ။
 *
 * ★ ဒါကြောင့် အိမ်ရဲ့ **အထဲကို တကယ် ဆက်နေတဲ့ နံရံ**ကို ရွေးပြီး အဲဒီမှာ
 *   အပေါက် ဖောက်တယ်၊ ကိုယ့် ပတ္တာတံခါးရွက်နဲ့ ပြန်ပိတ်တယ်။ ဒါဆို
 *   မော်ဒယ် ဘယ်လိုပဲ ဖြစ်ဖြစ် "နံရံက ခိုင်တယ်၊ တံခါးက ပွင့်တယ်" ဆိုတာ
 *   အာမခံနိုင်တယ် — item အသစ် တင်တိုင်း လက်နဲ့ ချိန်စရာ မလိုဘူး。
 *
 * @param prefer — အခန်းက ပြောတဲ့ ဘက် (ရနိုင်ရင် ဒါကို ဦးစားပေး)
 * @param width  — တံခါးဝ အကျယ် (m)
 * @returns { x, z, width, facing } | null
 */
export function cutDoorway(grid, prefer = '+z', width = 2.4) {
  const { cols, rows, cell, minX, minZ, occ } = grid;

  // ★ **အဆောက်အအုံရဲ့ အကျယ်အဝန်း အတွင်းမှာပဲ** တိုင်းရမယ်။ ဒါ မလုပ်ခဲ့လို့
  //   အမှား ဖြစ်ခဲ့တယ်: နံရံရဲ့ အတွင်းဘက် တစ်တန်းမှာ အလွတ် ဘယ်လောက်
  //   ရှိလဲ ရေတွက်တဲ့အခါ **အိမ်ရဲ့ အပြင်ဘက်က ဟင်းလင်းပြင်ကိုပါ**
  //   ရေတွက်မိတယ်။ ဒါကြောင့် အခိုင်အမာ တုံးကြီး ရှိတဲ့ +x ဘက်က
  //   အမှတ် အများဆုံး ရသွားပြီး တံခါးကို **တုံးထဲကို** ဖောက်မိတယ်
  //   (physics မြေပုံ ပုံနှိပ်တော့မှ တွေ့တာ)。
  let c0 = cols, c1 = -1, r0 = rows, r1 = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occ[r * cols + c]) continue;
      if (c < c0) c0 = c; if (c > c1) c1 = c;
      if (r < r0) r0 = r; if (r > r1) r1 = r;
    }
  }
  if (c1 < 0) return null;

  const best = { score: -1 };
  for (const side of [prefer, '+z', '-z', '+x', '-x']) {
    const axisZ = side === '+z' || side === '-z';
    const len = axisZ ? rows : cols;
    const across = axisZ ? cols : rows;
    const at = (line, j) => (axisZ ? occ[line * cols + j] : occ[j * cols + line]);
    const lineOcc = (i) => { let n = 0; for (let j = 0; j < across; j++) if (at(i, j)) n++; return n; };

    let peak = 0;
    for (let i = 0; i < len; i++) { const n = lineOcc(i); if (n > peak) peak = n; }
    if (peak < 3) continue;
    const need = Math.max(3, peak * 0.5);

    const step = (side === '+z' || side === '+x') ? -1 : 1;
    let line = -1;
    for (let k = 0; k < len; k++) {
      const i = step < 0 ? len - 1 - k : k;
      if (lineOcc(i) >= need) { line = i; break; }
    }
    if (line < 0) continue;

    // ★ ဒီနံရံရဲ့ **အတွင်းဘက်**မှာ အခန်းလွတ် ရှိလား — ရှိမှ တံခါး ဖောက်လို့
    //   အဓိပ္ပာယ် ရှိတယ် (မဟုတ်ရင် အခိုင်အမာ တုံးထဲကို ဖောက်မိမယ်)。
    // ★ အတွင်းဘက် = `step` ဘက် (`line` ကို အဲဒီ ဘက်ကနေ ရှာခဲ့တာမို့)。
    //   `-step` လို့ ရေးမိလို့ probe က **အပြင်ဘက်**ကို ကြည့်နေတယ်။
    const dirIn = step;
    const lo = axisZ ? c0 : r0, hi = axisZ ? c1 : r1;   // အဆောက်အအုံ အတွင်းသာ
    // ★ နံရံကနေ အတွင်းဘက် ၂/၄/၆ ကွက်မှာ စမ်းတယ် — အခန်းက တစ်ချို့မှာ
    //   ကျဉ်းတယ်၊ တစ်ချို့မှာ နံရံနှစ်ထပ် ရှိတယ်။ တစ်နေရာတည်း ကြည့်ရင်
    //   အခန်းရှိပါလျက် "မရှိဘူး" လို့ ထင်ပြီး တံခါး လုံးဝ မဖောက်ဖြစ်ဘူး။
    let bestRun = { start: -1, len: 0 };
    for (const depth of [2, 4, 6]) {
      const probeLine = line + dirIn * depth;
      if (probeLine < 0 || probeLine >= len) continue;
      let s = -1;
      for (let j = lo; j <= hi + 1; j++) {
        const free = j <= hi && !at(probeLine, j);
        if (free && s < 0) s = j;
        if (!free && s >= 0) {
          if (j - s > bestRun.len) bestRun = { start: s, len: j - s };
          s = -1;
        }
      }
    }
    const score = bestRun.len;
    if (score > best.score) {
      best.score = score; best.side = side; best.line = line;
      best.axisZ = axisZ; best.step = step; best.run = bestRun; best.across = across;
    }
  }
  if (best.score < 2) return null;

  // ── အပေါက် ဖောက် — နံရံတန်း ၃ တန်းစာ ရှင်း ─────────────────────────
  const nCells = Math.max(3, Math.round(width / cell));
  const mid = best.run.start + best.run.len / 2;
  const j0 = Math.max(0, Math.round(mid - nCells / 2));
  const j1 = Math.min(best.across - 1, j0 + nCells - 1);
  const lenAxis = best.axisZ ? rows : cols;
  for (let k = -1; k <= 3; k++) {
    const line = best.line + best.step * k;
    if (line < 0 || line >= lenAxis) continue;
    for (let j = j0; j <= j1; j++) {
      if (best.axisZ) occ[line * cols + j] = 0;
      else occ[j * cols + line] = 0;
    }
  }

  const along = ((j0 + j1 + 1) / 2) * cell;
  const wall = (best.line + 0.5) * cell;
  const w = (j1 - j0 + 1) * cell;
  return best.axisZ
    ? { x: minX + along, z: minZ + wall, width: w, facing: best.side }
    : { x: minX + wall, z: minZ + along, width: w, facing: best.side };
}
