/// Client netcode (spec A5.4) ရဲ့ acceptance criteria。
///
/// ★ ဒီအပိုင်းက မမြင်ရဘူး — အလုပ်လုပ်နေရင် ဘာမှ မထူးဆန်းဘူး၊ ပျက်နေရင်
///   "ခုန်တယ်"၊ "နောက်ကျတယ်" ဆိုပြီး ရှင်းပြရ ခက်တဲ့ report တွေ ဖြစ်တယ်။
///   ဒါကြောင့် တစ်ချက်ချင်းစီကို ကိန်းဂဏန်းနဲ့ ပုံသေ ချုပ်ထားတယ်။

import test from "node:test";
import assert from "node:assert/strict";

import {
  createInterpolator,
  createPredictor,
  lerpAngle,
  simulateMove,
  INTERP_DELAY_MS,
  RUN_SPEED,
  WALK_SPEED,
} from "./net.ts";

// ── simulateMove ─────────────────────────────────────────────────────────

test("moving is speed times time, in the input direction", () => {
  const p = simulateMove({ x: 0, z: 0 }, { seq: 1, mx: 1, mz: 0, dt: 1, run: false });
  assert.equal(Math.round(p.x * 100) / 100, WALK_SPEED);
  assert.equal(p.z, 0);
});

test("running is faster than walking", () => {
  const walk = simulateMove({ x: 0, z: 0 }, { seq: 1, mx: 1, mz: 0, dt: 1, run: false });
  const run = simulateMove({ x: 0, z: 0 }, { seq: 1, mx: 1, mz: 0, dt: 1, run: true });
  assert.ok(run.x > walk.x);
  assert.equal(Math.round(run.x * 100) / 100, RUN_SPEED);
});

test("diagonal input is normalised", () => {
  // ★ မညှိရင် ထောင့်ဖြတ် ပြေးတာက ရှေ့တည့်တည့် ပြေးထက် ၁.၄ ဆ ပိုမြန်တယ် —
  //   ဒါက ရှေးဂိမ်းတွေရဲ့ ဂန္ထဝင် bug ("bunny hopping" ရဲ့ ဆွေမျိုး)。
  const p = simulateMove({ x: 0, z: 0 }, { seq: 1, mx: 1, mz: 1, dt: 1, run: false });
  assert.equal(Math.round(Math.hypot(p.x, p.z) * 100) / 100, WALK_SPEED);
});

test("no input means no movement", () => {
  const p = simulateMove({ x: 5, z: 5 }, { seq: 1, mx: 0, mz: 0, dt: 1, run: false });
  assert.deepEqual(p, { x: 5, z: 5 });
});

test("walking speed stays under the server's anti-cheat cap", () => {
  // ★ server.js က MAX_SPEED = 8.4。 ဒီထက် မြန်ရင် ပုံမှန် ပြေးရုံနဲ့
  //   server က ငြင်းပြီး ကစားသမား နောက်ပြန် ဆွဲခံရမယ်။
  assert.ok(RUN_SPEED < 8.4, `${RUN_SPEED} exceeds the server cap`);
});

// ── Prediction ───────────────────────────────────────────────────────────

test("your own movement is instant, with no round trip", () => {
  const p = createPredictor({ x: 0, z: 0 });
  p.apply(1, 0, 0.1, false);
  assert.ok(p.position.x > 0, "moved before the server said anything");
});

test("inputs are numbered from one, in order", () => {
  const p = createPredictor({ x: 0, z: 0 });
  assert.equal(p.apply(1, 0, 0.1, false).seq, 1);
  assert.equal(p.apply(1, 0, 0.1, false).seq, 2);
});

test("an ack clears the inputs the server has seen", () => {
  const p = createPredictor({ x: 0, z: 0 });
  p.apply(1, 0, 0.1, false);
  p.apply(1, 0, 0.1, false);
  p.apply(1, 0, 0.1, false);
  assert.equal(p.pendingCount, 3);
  p.reconcile({ x: 0.34, z: 0 }, 2);
  assert.equal(p.pendingCount, 1);
});

test("an agreeing server leaves the position alone", () => {
  const p = createPredictor({ x: 0, z: 0 });
  const cmd = p.apply(1, 0, 1, false);
  const expected = simulateMove({ x: 0, z: 0 }, cmd);
  const before = p.position;
  const r = p.reconcile(expected, cmd.seq);
  assert.equal(r.corrected, false);
  assert.ok(Math.hypot(p.position.x - before.x, p.position.z - before.z) < 0.01);
});

test("a small disagreement is eased, not snapped", () => {
  // ★ ချက်ချင်း ရွှေ့ရင် ကစားသမားက တဆတ်ဆတ် ခုန်နေတယ် လို့ မြင်ရမယ်။
  const p = createPredictor({ x: 0, z: 0 });
  const cmd = p.apply(1, 0, 1, false);
  const predicted = p.position;
  const r = p.reconcile({ x: predicted.x - 0.5, z: 0 }, cmd.seq);
  assert.equal(r.corrected, false);
  assert.ok(p.position.x < predicted.x, "moved toward the server");
  assert.ok(p.position.x > predicted.x - 0.5, "but not all the way in one step");
});

test("a large disagreement snaps immediately", () => {
  // ★ နံရံထဲ လျှောက်နေတဲ့အခါ ညင်သာစွာ ဆွဲရင် ကစားသမားက နံရံထဲမှာ
  //   ကြာကြာ ကျန်နေမယ်။
  const p = createPredictor({ x: 0, z: 0 });
  const cmd = p.apply(1, 0, 1, false);
  const r = p.reconcile({ x: 50, z: 0 }, cmd.seq);
  assert.equal(r.corrected, true);
  assert.equal(p.position.x, 50);
});

test("unacked inputs are replayed on top of the server position", () => {
  // ★ ဒါက reconciliation ရဲ့ အနှစ်သာရ — server ရဲ့ အဖြေက ၂၀၀ms
  //   ဟောင်းနေတယ်၊ အဲဒီနောက်က input တွေကို ပြန်မတွက်ရင် ကစားသမား
  //   အမြဲ နောက်ပြန် ဆွဲခံရမယ်။
  const p = createPredictor({ x: 0, z: 0 });
  p.apply(1, 0, 1, false); // seq 1 — server က သိပြီး
  p.apply(1, 0, 1, false); // seq 2 — မသိသေး
  p.apply(1, 0, 1, false); // seq 3 — မသိသေး
  const serverAfterOne = { x: WALK_SPEED, z: 0 };
  p.reconcile(serverAfterOne, 1);
  // server နေရာ + မအတည်ပြုရသေးတဲ့ ၂ ခု = ၃ ခုစာ
  assert.ok(Math.abs(p.position.x - WALK_SPEED * 3) < 0.01, `got ${p.position.x}`);
});

test("reset drops every prediction", () => {
  const p = createPredictor({ x: 0, z: 0 });
  p.apply(1, 0, 1, false);
  p.reset({ x: 10, z: 10 });
  assert.deepEqual(p.position, { x: 10, z: 10 });
  assert.equal(p.pendingCount, 0);
});

test("the pending buffer is bounded when acks never arrive", () => {
  const p = createPredictor({ x: 0, z: 0 });
  for (let i = 0; i < 5000; i++) p.apply(1, 0, 0.016, false);
  assert.ok(p.pendingCount <= 240, `${p.pendingCount} pending commands`);
});

// ── Interpolation ────────────────────────────────────────────────────────

test("a single sample is shown as-is", () => {
  const it = createInterpolator();
  it.push("a", { t: 1000, x: 5, y: 0, z: 5, ry: 0 });
  assert.equal(it.sample("a", 1000 + INTERP_DELAY_MS)?.x, 5);
});

test("positions between two samples are interpolated", () => {
  const it = createInterpolator();
  it.push("a", { t: 1000, x: 0, y: 0, z: 0, ry: 0 });
  it.push("a", { t: 1100, x: 10, y: 0, z: 0, ry: 0 });
  // now - 100ms = 1050 → ကြားတစ်ဝက်
  const s = it.sample("a", 1150);
  assert.ok(s);
  assert.equal(Math.round(s.x), 5);
});

test("the render is delayed by the interpolation buffer", () => {
  // ★ ဒါက feature ဖြစ်တယ် bug မဟုတ်ဘူး — ကြားညှိဖို့ နမူနာ ၂ ခု
  //   လက်ထဲမှာ ရှိဖို့ လိုတယ်။
  const it = createInterpolator();
  it.push("a", { t: 1000, x: 0, y: 0, z: 0, ry: 0 });
  it.push("a", { t: 1100, x: 10, y: 0, z: 0, ry: 0 });
  assert.equal(it.sample("a", 1100)?.x, 0, "at t=1100 we render what was true at t=1000");
});

test("the newest sample is held rather than extrapolated", () => {
  // ★ ရှေ့ဆက် ခန့်မှန်းရင် တကယ့်ကစားသမား ရပ်လိုက်တဲ့အခါ နောက်ပြန်
  //   ခုန်တယ်။ နောက်ကျပြီး မှန်တာက အချိန်မှန်ပြီး ခုန်တာထက် ကောင်းတယ်။
  const it = createInterpolator();
  it.push("a", { t: 1000, x: 0, y: 0, z: 0, ry: 0 });
  it.push("a", { t: 1100, x: 10, y: 0, z: 0, ry: 0 });
  const far = it.sample("a", 9999);
  assert.equal(far?.x, 10, "held at the last known position, not projected past it");
});

test("out-of-order samples are dropped", () => {
  const it = createInterpolator();
  it.push("a", { t: 1100, x: 10, y: 0, z: 0, ry: 0 });
  it.push("a", { t: 1000, x: 0, y: 0, z: 0, ry: 0 });
  assert.equal(it.sample("a", 9999)?.x, 10);
});

test("an unknown player samples to null", () => {
  assert.equal(createInterpolator().sample("nobody", 1)?.x, undefined);
});

test("removing a player forgets their track", () => {
  const it = createInterpolator();
  it.push("a", { t: 1000, x: 1, y: 0, z: 0, ry: 0 });
  it.remove("a");
  assert.equal(it.sample("a", 2000), null);
  assert.deepEqual(it.ids(), []);
});

test("old samples are trimmed", () => {
  const it = createInterpolator();
  for (let i = 0; i < 500; i++) it.push("a", { t: 1000 + i * 50, x: i, y: 0, z: 0, ry: 0 });
  // ၂ စက္ကန့်စာထက် မကျန်ရ — ၅၀ms tick ဆိုတော့ ~၄၀ နမူနာဝန်းကျင်
  assert.ok(it.sample("a", 100000));
});

// ── ထောင့် ───────────────────────────────────────────────────────────────

test("angles take the short way round", () => {
  // ★ ဒါမရှိရင် ကစားသမားက ညာဘက် ၂၀° လှည့်တိုင်း ဘယ်ဘက်ကို ၃၄၀° ပတ်တယ်။
  const TAU = Math.PI * 2;
  const near = lerpAngle(TAU - 0.1, 0.1, 0.5);
  assert.ok(Math.abs(((near % TAU) + TAU) % TAU) < 0.05 || Math.abs(near) < 0.05, `${near}`);
});

test("angle interpolation is stable at the endpoints", () => {
  assert.equal(lerpAngle(1, 2, 0), 1);
  assert.ok(Math.abs(lerpAngle(1, 2, 1) - 2) < 1e-9);
});

test("rotation is interpolated between samples", () => {
  const it = createInterpolator();
  it.push("a", { t: 1000, x: 0, y: 0, z: 0, ry: 0 });
  it.push("a", { t: 1100, x: 0, y: 0, z: 0, ry: Math.PI / 2 });
  const s = it.sample("a", 1150);
  assert.ok(s && Math.abs(s.ry - Math.PI / 4) < 0.01);
});
