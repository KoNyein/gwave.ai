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
import {
  airspeedFactor,
  batterySag,
  createState,
  groundEffect,
  speedKmh,
  updateDrone,
  vortexRing,
  type Sticks,
} from "./physics.ts";

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

// ── လေအားပညာ / ဘက်ထရီ ─────────────────────────────────────────────────
//
// ★ ဒါတွေက ဖန်သားပြင်ပေါ်မှာ **တိုက်ရိုက် မမြင်ရဘူး** — ခံစားချက်ကိုသာ
//   ပြောင်းတယ်။ ဒါကြောင့် ဂဏန်းအဆင့်မှာ ချည်ထားမှ ကျိုးသွားရင် သိမယ်။

test("🔋 pack အားကုန်လာရင် တွန်းအား ကျတယ်", () => {
  const d = getDrone("raptor5");
  const fresh = batterySag(0, d, 0.5);
  const empty = batterySag(d.batterySec, d, 0.5);
  assert.ok(fresh > empty, `${fresh} က ${empty} ထက် များရမယ်`);
  // အစပိုင်းမှာ သိသိသာသာ မကျရဘူး — အဲဒါ ခံစားလို့ ဆိုးတယ်
  assert.ok(batterySag(d.batterySec * 0.25, d, 0.5) > fresh * 0.985);
  // ဒါပေမယ့် နောက်ဆုံးမှာ ခံစားရလောက်အောင် ကျရမယ်
  assert.ok(empty < fresh * 0.9, `နောက်ဆုံးမှာ ${empty / fresh} ပဲ ကျတယ်`);
});

test("🔋 throttle ဖိထားရင် ချက်ချင်း voltage ကျတယ် (load sag)", () => {
  const d = getDrone("raptor5");
  assert.ok(batterySag(0, d, 1) < batterySag(0, d, 0));
});

test("🛬 မြေပြင်နားမှာ တွန်းအား ပိုရတယ် — အမြင့်မှာ မရ", () => {
  const d = getDrone("raptor5");
  assert.ok(groundEffect(0.08, d) > 1.02, `${groundEffect(0.08, d)}`);
  assert.equal(groundEffect(20, d), 1, "အမြင့်မှာ ground effect မရှိရ");
  // နီးလေ များလေ ဖြစ်ရမယ် (တစ်ခုတည်းသော ဦးတည်ချက်)
  assert.ok(groundEffect(0.1, d) > groundEffect(0.3, d));
});

test("★ 🛬 duct ပါရင် ground effect ပိုသိသာတယ်", () => {
  // Duct က လေကို ဘေးမထွက်အောင် ပိတ်ထားလို့ မြေပြင်နားမှာ ပိုတွန်းတယ် —
  // Avata စတိုင် drone က မြေနားပျံရတာ ပိုလွယ်ရမယ်။
  const open = getDrone("raptor5");
  const duct = getDrone("avata2");
  assert.ok(duct.ducted, "avata2 က ducted ဖြစ်ရမယ်");
  assert.ok(groundEffect(0.02, duct) > groundEffect(0.02, open));
});

test("★ 🌀 ဒေါင်လိုက် ဆင်းနေရင် တွန်းအား ပျောက်တယ် (vortex ring)", () => {
  const d = getDrone("raptor5");
  const straightDown = new THREE.Vector3(0, -5, 0);
  assert.ok(vortexRing(straightDown, d, 0.6) < 0.95, "settling with power ဖြစ်ရမယ်");
  // နှေးနှေး ဆင်းရင် မဖြစ်ဘူး
  assert.equal(vortexRing(new THREE.Vector3(0, -1, 0), d, 0.6), 1);
});

test("★ 🌀 ရှေ့တိုးလိုက်ရင် လေဝဲထဲက ထွက်တယ်", () => {
  // တကယ့် ပျံသန်းရေးမှာ settling with power ကနေ ထွက်နည်းက "ရှေ့တိုးပါ" —
  // sim မှာလည်း အဲဒီအတိုင်း အလုပ်လုပ်ရမယ်။
  const d = getDrone("raptor5");
  const stuck = vortexRing(new THREE.Vector3(0, -5, 0), d, 0.6);
  const moving = vortexRing(new THREE.Vector3(0, -5, 6), d, 0.6);
  assert.ok(moving > stuck, `ရှေ့တိုးရင် ပြန်ကောင်းရမယ် — ${moving} vs ${stuck}`);
  assert.equal(moving, 1);
});

test("💨 ရှေ့ကို ရွေ့နေရင် rotor က ပိုထိရောက်တယ်", () => {
  const d = getDrone("raptor5");
  assert.ok(airspeedFactor(new THREE.Vector3(8, 0, 0), d) > airspeedFactor(new THREE.Vector3(), d));
});

test("★ ဒီအချက်တွေ ပေါင်းလိုက်လည်း quad က hover လုပ်နိုင်ရမယ်", () => {
  // ★ သဘောတရား ၄ ခု ထပ်ထည့်ပြီးနောက် drone က မတက်နိုင်တော့ဘူး ဒါမှမဟုတ်
  //   ထိန်းလို့ မရတော့ဘူး ဖြစ်သွားရင် sim တစ်ခုလုံး အသုံးမဝင်တော့ဘူး —
  //   ဒါကြောင့် hover ရနိုင်တဲ့ throttle တစ်ခု ရှိသေးလား စစ်တယ်။
  const low = fly("raptor5", sticks({ throttle: 0.3 }), 3, { spawnY: 30 });
  const high = fly("raptor5", sticks({ throttle: 0.9 }), 3, { spawnY: 30 });
  assert.ok(low.pos.y < 30, `0.3 မှာ ကျရမယ် — ${low.pos.y.toFixed(1)}`);
  assert.ok(high.pos.y > 30, `0.9 မှာ တက်ရမယ် — ${high.pos.y.toFixed(1)}`);
});

test("★ pack ကုန်ခါနီးမှာ တူညီတဲ့ stick နဲ့ ပိုနှေးရမယ်", () => {
  // ဒါက battery sag ကို **တကယ် ခံစားရလား** ဆိုတာ — function တစ်ခုတည်း
  // မဟုတ်ဘဲ ပျံသန်းမှုအဆင့်မှာ စစ်တာ။
  const d = getDrone("raptor5");
  const climb = (startSec: number) => {
    const s = createState(new THREE.Vector3(0, 30, 0), 0);
    s.armed = true;
    s.flightSec = startSec;
    for (let i = 0; i < 120; i++) {
      updateDrone(s, d, "acro", sticks({ throttle: 0.8 }), 1 / 60, NO_COLLIDERS);
    }
    return s.pos.y - 30;
  };
  assert.ok(climb(0) > climb(d.batterySec), "pack အသစ်က ပိုမြန်တက်ရမယ်");
});
