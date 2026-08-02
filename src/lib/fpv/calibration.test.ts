/// Transmitter calibration — the maths, verified without a transmitter.
///
/// Run: `node --experimental-strip-types --test src/lib/fpv/calibration.test.ts`
///
/// ★ There is no radio attached to CI, and there never will be. The wizard is
///   therefore written as a pure state machine fed raw axis arrays, and these
///   tests drive it with synthetic stick sweeps — including the awkward ones:
///   a radio whose sticks only reach ±0.8, a gimbal resting off-centre, an
///   axis wired backwards, and a pilot who moves the wrong stick.

import test from "node:test";
import assert from "node:assert";

import {
  CHANNEL_ORDERS,
  DEFAULT_MAP,
  createCalibrator,
  normalize,
  normalizeThrottle,
  presetMap,
  type AxisCal,
} from "./calibration.ts";

// ── Presets ────────────────────────────────────────────────────────────────
test("every channel order maps the four functions to four distinct axes", () => {
  for (const order of Object.keys(CHANNEL_ORDERS) as (keyof typeof CHANNEL_ORDERS)[]) {
    const m = presetMap(order);
    const axes = [m.roll, m.pitch, m.throttle, m.yaw];
    assert.equal(new Set(axes).size, 4, `${order}: two functions share an axis`);
    assert.deepEqual([...axes].sort(), [0, 1, 2, 3], `${order}: axes must be 0-3`);
  }
});

test("AETR is the default — it is what EdgeTX ships", () => {
  assert.equal(DEFAULT_MAP.preset, "AETR");
  assert.equal(DEFAULT_MAP.roll, 0);
  assert.equal(DEFAULT_MAP.pitch, 1);
  assert.equal(DEFAULT_MAP.throttle, 2);
  assert.equal(DEFAULT_MAP.yaw, 3);
});

test("TAER puts throttle first (Spektrum)", () => {
  const m = presetMap("TAER");
  assert.equal(m.throttle, 0);
  assert.equal(m.roll, 1);
  assert.equal(m.pitch, 2);
  assert.equal(m.yaw, 3);
});

// ── Normalisation ──────────────────────────────────────────────────────────
const cal = (over: Partial<AxisCal> = {}): AxisCal => ({
  min: -1,
  max: 1,
  center: 0,
  deadband: 0.04,
  ...over,
});

test("a centred stick reads exactly zero", () => {
  assert.equal(normalize(0, cal()), 0);
});

test("★ an off-centre gimbal still rests at zero", () => {
  // A trimmed or worn stick sits at 0.06. Without centre compensation the
  // drone drifts constantly and the pilot blames the drone.
  const c = cal({ center: 0.06 });
  assert.equal(normalize(0.06, c), 0);
  assert.ok(normalize(0.09, c) === 0, "just outside centre is still deadband");
  assert.ok(normalize(0.5, c) > 0.3);
});

test("★ short-travel sticks still reach full deflection", () => {
  // A radio that only outputs ±0.8 would otherwise cap the pilot at 80% rate
  // — the drone feels sluggish for no visible reason.
  const c = cal({ min: -0.8, max: 0.8 });
  assert.ok(normalize(0.8, c) > 0.99, `got ${normalize(0.8, c)}`);
  assert.ok(normalize(-0.8, c) < -0.99);
});

test("asymmetric travel is scaled per side", () => {
  const c = cal({ min: -0.5, max: 1.0 });
  assert.ok(normalize(1.0, c) > 0.99);
  assert.ok(normalize(-0.5, c) < -0.99);
});

test("never exceeds ±1 even past the calibrated ends", () => {
  const c = cal({ min: -0.8, max: 0.8 });
  assert.ok(normalize(1.0, c) <= 1);
  assert.ok(normalize(-1.0, c) >= -1);
});

test("output rises smoothly from the deadband, not in a jump", () => {
  // Rescaling outside the deadband matters: without it the stick snaps from
  // 0 straight to 0.04 the instant it leaves centre.
  const c = cal({ deadband: 0.1 });
  const justOut = normalize(0.11, c);
  assert.ok(justOut > 0 && justOut < 0.03, `expected a small value, got ${justOut}`);
});

test("throttle bottoms at exactly 0 and tops at 1, inverted or not", () => {
  const c = cal();
  assert.equal(normalizeThrottle(-1, c, false), 0);
  assert.ok(normalizeThrottle(1, c, false) > 0.99);
  // Inverted: the HID convention has stick-up = −1, which is how nearly every
  // EdgeTX radio arrives.
  assert.equal(normalizeThrottle(1, c, true), 0);
  assert.ok(normalizeThrottle(-1, c, true) > 0.99);
});

test("★ a resting throttle stick means zero throttle", () => {
  // Anything above zero here is a quad that creeps across the floor the
  // moment it is armed.
  const c = cal({ min: -0.98, max: 0.99, deadband: 0.05 });
  assert.equal(normalizeThrottle(-0.98, c, false), 0);
  assert.equal(normalizeThrottle(-0.95, c, false), 0);
});

// ── Wizard ─────────────────────────────────────────────────────────────────

/// Drive the wizard through a full run on a synthetic 4-axis radio.
/// [layout] gives the axis index each function lives on; [inverted] lists the
/// functions whose axis runs backwards.
function runWizard(opts: {
  layout: Record<string, number>;
  inverted?: string[];
  travel?: number;
  restNoise?: number;
  centers?: Record<number, number>;
}) {
  const axisCount = 4;
  const c = createCalibrator(axisCount);
  const travel = opts.travel ?? 1;
  const inverted = new Set(opts.inverted ?? []);
  const centers = opts.centers ?? {};
  const rest = (i: number) => centers[i] ?? 0;

  const frame = (over: Record<number, number> = {}) => {
    const a = [0, 1, 2, 3].map((i) => over[i] ?? rest(i));
    return a;
  };

  c.start();
  // Centre: hold still, with a touch of noise so the deadband is realistic.
  for (let i = 0; i < 60; i++) {
    const n = (opts.restNoise ?? 0) * (i % 2 === 0 ? 1 : -1);
    c.sample(frame({ 0: rest(0) + n, 1: rest(1) + n, 2: rest(2) + n, 3: rest(3) + n }));
  }

  // Each sweep: 100 samples, first half toward the "positive" direction the
  // prompt asks for, second half the other way.
  for (const fn of ["roll", "pitch", "throttle", "yaw"]) {
    const axis = opts.layout[fn]!;
    const sign = inverted.has(fn) ? -1 : 1;
    for (let i = 0; i < 100; i++) {
      const phase = i < 50 ? i / 49 : (99 - i) / 49 - 1; // +1 … -1
      c.sample(frame({ [axis]: rest(axis) + sign * phase * travel }));
    }
  }
  return c;
}

test("★ the wizard finds each function on the axis that actually moved", () => {
  // A deliberately odd radio: nothing like AETR, which is exactly the case
  // presets cannot cover.
  const c = runWizard({ layout: { roll: 2, pitch: 0, throttle: 3, yaw: 1 } });
  assert.equal(c.step, "done");
  assert.ok(c.complete(), "not every function was identified");
  const m = c.result(DEFAULT_MAP);
  assert.equal(m.roll, 2);
  assert.equal(m.pitch, 0);
  assert.equal(m.throttle, 3);
  assert.equal(m.yaw, 1);
  assert.equal(m.preset, "custom");
});

test("★ a backwards axis is detected and inverted", () => {
  const c = runWizard({
    layout: { roll: 0, pitch: 1, throttle: 2, yaw: 3 },
    inverted: ["pitch", "throttle"],
  });
  const m = c.result(DEFAULT_MAP);
  assert.equal(m.invPitch, true);
  assert.equal(m.invThrottle, true);
  assert.equal(m.invRoll, false, "roll was swept the normal way");
  assert.equal(m.invYaw, false);
});

test("★ measured endpoints are stored, not assumed", () => {
  const c = runWizard({ layout: { roll: 0, pitch: 1, throttle: 2, yaw: 3 }, travel: 0.8 });
  const m = c.result(DEFAULT_MAP);
  assert.ok(m.cal, "no calibration recorded");
  assert.ok(m.cal!.roll.max <= 0.81 && m.cal!.roll.max >= 0.79,
      `max ${m.cal!.roll.max}`);
  // And normalising through it must recover full deflection.
  assert.ok(normalize(0.8, m.cal!.roll) > 0.99);
});

test("★ an off-centre rest position is captured", () => {
  const c = runWizard({
    layout: { roll: 0, pitch: 1, throttle: 2, yaw: 3 },
    centers: { 0: 0.07 },
  });
  const m = c.result(DEFAULT_MAP);
  assert.ok(Math.abs(m.cal!.roll.center - 0.07) < 0.02,
      `centre ${m.cal!.roll.center}`);
  assert.equal(normalize(0.07, m.cal!.roll), 0, "rest position must read zero");
});

test("★ a noisy gimbal gets a wider deadband than a quiet one", () => {
  const quiet = runWizard({ layout: { roll: 0, pitch: 1, throttle: 2, yaw: 3 } });
  const noisy = runWizard({
    layout: { roll: 0, pitch: 1, throttle: 2, yaw: 3 },
    restNoise: 0.05,
  });
  const q = quiet.result(DEFAULT_MAP).cal!.roll.deadband;
  const n = noisy.result(DEFAULT_MAP).cal!.roll.deadband;
  assert.ok(n > q, `noisy ${n} should exceed quiet ${q}`);
  assert.ok(q >= 0.015, "a deadband of zero lets the drone drift");
});

test("★ moving the same stick twice is reported as a conflict", () => {
  // The pilot swept roll for both the roll and pitch prompts. Saving that
  // gives two functions on one axis and a drone that cannot be flown.
  const c = runWizard({ layout: { roll: 0, pitch: 0, throttle: 2, yaw: 3 } });
  assert.ok(c.conflicts().length > 0, "conflict went undetected");
});

test("a stick that never moves leaves the previous mapping alone", () => {
  const c = createCalibrator(4);
  c.start();
  for (let i = 0; i < 60; i++) c.sample([0, 0, 0, 0]);
  // Sweep only roll; the rest stay still.
  for (let i = 0; i < 100; i++) {
    const phase = i < 50 ? i / 49 : (99 - i) / 49 - 1;
    c.sample([phase, 0, 0, 0]);
  }
  for (let s = 0; s < 3; s++) for (let i = 0; i < 100; i++) c.sample([0, 0, 0, 0]);

  assert.equal(c.complete(), false, "should not claim a complete run");
  const m = c.result(DEFAULT_MAP);
  assert.equal(m.pitch, DEFAULT_MAP.pitch, "untouched functions keep their mapping");
  assert.equal(m.roll, 0);
});

test("cancel stops the run without touching anything", () => {
  const c = createCalibrator(4);
  c.start();
  c.sample([0, 0, 0, 0]);
  c.cancel();
  assert.equal(c.step, "idle");
  const p = c.sample([1, 1, 1, 1]);
  assert.equal(p.step, "idle");
});
