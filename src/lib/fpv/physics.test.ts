/// FPV physics — ယာဉ်အမျိုးအစား ၃ မျိုးရဲ့ အပြုအမူ။
///
/// Run: `node --experimental-strip-types --test src/lib/fpv/physics.test.ts`
///
/// ★ ဒါတွေက **ခံစားချက်ကို သတ်မှတ်တဲ့ စည်းမျဉ်း** တွေ — quad က hover ရမယ်၊
///   လေယာဉ်က ပြေးထွက်ပြီးမှ မြောက်ရမယ်၊ heli က throttle တစ်ဝက်မှာ ရပ်ရမယ်။
///   ဒါတွေ ပျက်ရင် browser မှာ တစ်ချက်ကြည့်ရုံနဲ့ မသိဘူး (နာရီဝက် မောင်းမှ
///   သိတယ်) — ဒါကြောင့် test နဲ့ ချည်ထားတယ်။

import test from "node:test";
import assert from "node:assert";

import * as THREE from "three";

import { getDrone, type FlightMode } from "./drones.ts";
import { createState, speedKmh, updateDrone, type Sticks } from "./physics.ts";

const NO_COLLIDERS: { min: THREE.Vector3; max: THREE.Vector3 }[] = [];
const sticks = (over: Partial<Sticks> = {}): Sticks => ({
  throttle: 0,
  roll: 0,
  pitch: 0,
  yaw: 0,
  ...over,
});

/// စက္ကန့် n အထိ ပျံစေတယ် (frame 60Hz)
///
/// ★ Mode က မဖြစ်မနေ ရွေးရမယ် — acro မှာ stick က **rate** ဖြစ်လို့ pitch
///   ကို ဆက်ဖိထားရင် ရှေ့သို့ အဆက်မပြတ် လှိမ့်နေမယ် (loop)。 လေယာဉ်ကို
///   အဲဒီလို စမ်းရင် ဘယ်တော့မှ မတက်ဘူး — sport (angle) မှာသာ ထောင့်တစ်ခု
///   ကို ကိုင်ထားတယ်။
function fly(
  droneId: string,
  st: Sticks,
  seconds: number,
  opts?: { armed?: boolean; spawnY?: number; mode?: FlightMode },
) {
  const drone = getDrone(droneId);
  const s = createState(new THREE.Vector3(0, opts?.spawnY ?? 1.2, 0), 0);
  s.armed = opts?.armed ?? true;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    updateDrone(s, drone, opts?.mode ?? "acro", st, 1 / 60, NO_COLLIDERS);
  }
  return s;
}

// ── 🛸 Quad ────────────────────────────────────────────────────────────
test("quad: throttle မတင်ရင် မြေပြင်ပေါ် ကျတယ်", () => {
  const s = fly("raptor5", sticks({ throttle: 0 }), 2, { spawnY: 20 });
  assert.ok(s.pos.y < 20, `ကျရမယ် — ${s.pos.y}`);
});

test("quad: throttle အပြည့်တင်ရင် တက်တယ်", () => {
  const s = fly("raptor5", sticks({ throttle: 1 }), 2, { spawnY: 5 });
  assert.ok(s.pos.y > 5, `တက်ရမယ် — ${s.pos.y}`);
});

test("quad: arm မလုပ်ရင် throttle တင်လည်း မတက်ဘူး", () => {
  const s = fly("raptor5", sticks({ throttle: 1 }), 1.5, {
    armed: false,
    spawnY: 10,
  });
  assert.ok(s.pos.y < 10, "disarm ဖြစ်နေရင် ကျရမယ်");
});

// ── ✈️ Plane ───────────────────────────────────────────────────────────
test("plane: မြေပြင်ပေါ် ပြေးထွက်ပြီး မြောက်တက်တယ် (crash မဖြစ်ရ)", () => {
  // ★ ဒါက regression test — ရှေ့အရှိန်ကို "တိုက်မိမှု" အဖြစ် ရေတွက်ခဲ့စဉ်က
  //   လေယာဉ်တွေက takeoff roll ထဲမှာပဲ ပေါက်ကွဲကုန်တယ်။
  for (const id of ["trainer12", "wing900"]) {
    const s = fly(id, sticks({ throttle: 1, pitch: -0.35 }), 12, {
      spawnY: 0.2,
      mode: "sport",
    });
    assert.equal(s.crashed, false, `${id}: လမ်းပေါ်မှာ ပျက်သွားတယ်`);
    assert.ok(s.pos.y > 2, `${id}: မြောက်မတက်ဘူး — ${s.pos.y.toFixed(1)}m`);
  }
});

test("plane: စောင်းပြီး မြေကို တိုက်မိရင် ပျက်ရမယ်", () => {
  // ★ ဒါက ကာကွယ်ချက် — လေယာဉ်မှာ ရှေ့အရှိန်ကို တိုက်မိမှုအဖြစ် မရေတွက်
  //   တော့လို့ "ဘာလုပ်လုပ် မပျက်တော့ဘူး" ဖြစ်မသွားစေရ။ အတောင်ထောင်ပြီး
  //   (lift မရှိတော့ဘဲ) ကျဆင်းရင် ဒေါင်လိုက်အရှိန် တက်လာလို့ ပျက်ရမယ်။
  const drone = getDrone("wing900");
  const s = createState(new THREE.Vector3(0, 6, 0), 0);
  s.armed = true;
  s.quat.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2, "YXZ")); // 90° bank
  s.vel.set(0, -4, -25);
  for (let i = 0; i < 120; i++) {
    updateDrone(s, drone, "acro", sticks({ throttle: 0.5 }), 1 / 60, NO_COLLIDERS);
  }
  assert.equal(s.crashed, true, "စောင်းပြီး မြေတိုက်တာ ပျက်ရမယ်");
});

test("plane: အရှိန်မရှိရင် အပေါ်တင်အား မရလို့ ကျတယ် (stall)", () => {
  // Throttle မတင်ဘဲ လေထဲကနေ စရင် အရှိန်မရှိသေးလို့ ကျရမယ်
  const s = fly("trainer12", sticks({ throttle: 0 }), 1.5, { spawnY: 40 });
  assert.ok(s.pos.y < 40, `lift မရှိရင် ကျရမယ် — ${s.pos.y}`);
});

test("plane: အရှိန်တက်လေ မြန်လေ", () => {
  const slow = fly("trainer12", sticks({ throttle: 0.3 }), 4, { spawnY: 0.2 });
  const fast = fly("trainer12", sticks({ throttle: 1 }), 4, { spawnY: 0.2 });
  assert.ok(
    speedKmh(fast) > speedKmh(slow),
    `throttle များတာက ပိုမြန်ရမယ် — ${speedKmh(fast)} vs ${speedKmh(slow)}`,
  );
});

// ── 🚁 Helicopter ──────────────────────────────────────────────────────
test("heli: throttle တစ်ဝက်လောက်မှာ hover နီးစပ်တယ်", () => {
  // Collective curve က linear မို့ hover point က ~0.4 ဝန်းကျင် ဖြစ်ရမယ်။
  // 0.2 မှာ ကျပြီး 0.7 မှာ တက်ရမယ် — အဲဒီကြားမှာ hover ရှိတယ်လို့ ဆိုလိုတယ်။
  const low = fly("heli450", sticks({ throttle: 0.2 }), 2, { spawnY: 20 });
  const high = fly("heli450", sticks({ throttle: 0.7 }), 2, { spawnY: 20 });
  assert.ok(low.pos.y < 20, `0.2 မှာ ကျရမယ် — ${low.pos.y.toFixed(1)}`);
  assert.ok(high.pos.y > 20, `0.7 မှာ တက်ရမယ် — ${high.pos.y.toFixed(1)}`);
});

test("heli: မြေပြင်ကို ပြင်းပြင်း ဆောင့်ချရင် ပျက်တယ်", () => {
  // Terminal velocity ~13.5 m/s မို့ 60m ကျဖို့ ၅ စက္ကန့်ကျော် လိုတယ်
  const s = fly("heli450", sticks({ throttle: 0 }), 9, { spawnY: 60 });
  assert.equal(s.crashed, true, "အမြင့်ကနေ ကျရင် ပျက်ရမယ်");
});

// ── ဘုံ ────────────────────────────────────────────────────────────────
test("မြေအောက်ကို ဘယ်တော့မှ မကျဘူး", () => {
  for (const id of ["raptor5", "trainer12", "heli450"]) {
    const s = fly(id, sticks({ throttle: 0 }), 5, { spawnY: 30 });
    assert.ok(s.pos.y >= 0, `${id}: မြေအောက် ရောက်သွားတယ် — ${s.pos.y}`);
  }
});

test("အဆောက်အအုံကို ဖြတ်မသွားရ", () => {
  const drone = getDrone("raptor5");
  const s = createState(new THREE.Vector3(0, 5, 6), 0);
  s.armed = true;
  const wall = [
    {
      min: new THREE.Vector3(-5, 0, -1),
      max: new THREE.Vector3(5, 12, 1),
    },
  ];
  // နံရံဆီ ရှေ့တိုးတယ် (-Z ဘက်)
  for (let i = 0; i < 240; i++) {
    updateDrone(s, drone, "acro", sticks({ throttle: 0.55, pitch: -0.6 }), 1 / 60, wall);
  }
  assert.ok(s.pos.z > -1.5, `နံရံကို ဖြတ်သွားတယ် — z=${s.pos.z.toFixed(2)}`);
});
