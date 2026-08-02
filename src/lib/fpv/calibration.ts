/// RC transmitter calibration — the parts that are actually standardised.
///
/// Two different conventions get confused constantly, so they are kept apart
/// here:
///
///   **Stick mode** (1–4) is where the *pilot's* functions sit physically.
///   Mode 2 (throttle on the left) is the world default; Mode 1 is still
///   common in parts of Asia and the UK; Modes 3 and 4 are rare but real.
///   Changing it is a radio-side setting — the simulator cannot see it.
///
///   **Channel order** (AETR / TAER / RETA / ETAR) is the order the radio
///   *transmits* those four functions in, and that is what arrives over USB
///   HID as axis 0,1,2,3. FrSky/OpenTX ships AETR, Spektrum TAER, Futaba
///   RETA. This is the thing the simulator has to match.
///
/// So the preset list below maps channel order → axis assignment, and the
/// wizard exists because a stack of radios still deviate from all of them.
/// Everything here is pure: no DOM, no Gamepad API, so it can be tested.

/// Per-axis calibration measured from the actual hardware.
export type AxisCal = {
  /// Lowest raw value seen while the stick was swept.
  min: number;
  /// Highest raw value seen.
  max: number;
  /// Where the stick sits at rest. Not always 0 — trims and worn gimbals
  /// push it off, and a 3% offset is a drone that slowly drifts.
  center: number;
  /// Half-width of the dead zone, from the noise measured at rest.
  deadband: number;
};

export const NEUTRAL_CAL: AxisCal = { min: -1, max: 1, center: 0, deadband: 0.04 };

export type AxisMap = {
  roll: number;
  pitch: number;
  throttle: number;
  yaw: number;
  invRoll: boolean;
  invPitch: boolean;
  invThrottle: boolean;
  invYaw: boolean;
  /// Measured calibration per function. Absent until the wizard has run.
  cal?: { roll: AxisCal; pitch: AxisCal; throttle: AxisCal; yaw: AxisCal };
  /// Which preset produced this map, for the UI to show.
  preset?: ChannelOrder | "custom";
};

export type StickFn = "roll" | "pitch" | "throttle" | "yaw";

/// The four transmit orders in use. Letters are the classic aircraft names:
/// A = aileron (roll), E = elevator (pitch), T = throttle, R = rudder (yaw).
export type ChannelOrder = "AETR" | "TAER" | "RETA" | "ETAR";

export const CHANNEL_ORDERS: Record<
  ChannelOrder,
  { order: StickFn[]; radios: string }
> = {
  AETR: {
    order: ["roll", "pitch", "throttle", "yaw"],
    radios: "FrSky · RadioMaster · Jumper (EdgeTX default)",
  },
  TAER: {
    order: ["throttle", "roll", "pitch", "yaw"],
    radios: "Spektrum · OpenTX default",
  },
  RETA: {
    order: ["yaw", "pitch", "throttle", "roll"],
    radios: "Futaba",
  },
  ETAR: {
    order: ["pitch", "throttle", "roll", "yaw"],
    radios: "Older Hitec / Multiplex",
  },
};

/// Stick modes, for the on-screen guide only — the radio decides this, and
/// no amount of remapping in the simulator changes which gimbal the pilot's
/// thumb is on.
export const STICK_MODES: Record<number, { left: string; right: string }> = {
  1: { left: "pitch + yaw", right: "throttle + roll" },
  2: { left: "throttle + yaw", right: "pitch + roll" },
  3: { left: "pitch + roll", right: "throttle + yaw" },
  4: { left: "throttle + roll", right: "pitch + yaw" },
};

/// Axis map for a transmit order.
///
/// ★ The inversions are the empirical part. A radio sends throttle low→high,
///   but the HID axis convention is up = −1, so throttle and pitch arrive
///   inverted on essentially every EdgeTX radio. Roll and yaw do not.
export function presetMap(order: ChannelOrder): AxisMap {
  const list = CHANNEL_ORDERS[order].order;
  const idx = (fn: StickFn) => list.indexOf(fn);
  return {
    roll: idx("roll"),
    pitch: idx("pitch"),
    throttle: idx("throttle"),
    yaw: idx("yaw"),
    invRoll: false,
    invPitch: true,
    invThrottle: true,
    invYaw: false,
    preset: order,
  };
}

export const DEFAULT_MAP: AxisMap = presetMap("AETR");

/// Normalise one raw axis reading to −1..1 using its calibration.
///
/// ★ Endpoints matter more than they look. A radio whose sticks only reach
///   ±0.85 leaves the pilot unable to reach full rate — the drone feels
///   sluggish and nobody can say why. Scaling to the measured travel fixes
///   it, and clamping stops a slightly-wider sweep later from exceeding 1.
export function normalize(raw: number, cal: AxisCal): number {
  const c = cal.center;
  const span = raw >= c ? cal.max - c : c - cal.min;
  if (span <= 1e-6) return 0;
  let v = (raw - c) / span;
  if (Math.abs(v) < cal.deadband) return 0;
  // Rescale outside the deadband so the stick still starts moving from zero
  // rather than jumping to the deadband value.
  const s = v < 0 ? -1 : 1;
  v = s * ((Math.abs(v) - cal.deadband) / (1 - cal.deadband));
  return Math.max(-1, Math.min(1, v));
}

/// Throttle wants 0..1, and the stick bottom must be exactly 0 — a resting
/// throttle of 0.02 is a quad that creeps across the floor when armed.
export function normalizeThrottle(raw: number, cal: AxisCal, invert: boolean): number {
  const lo = invert ? cal.max : cal.min;
  const hi = invert ? cal.min : cal.max;
  const span = hi - lo;
  if (Math.abs(span) <= 1e-6) return 0;
  const v = (raw - lo) / span;
  if (v < cal.deadband) return 0;
  return Math.max(0, Math.min(1, v));
}

// ── Wizard ─────────────────────────────────────────────────────────────────

export type CalStep = "idle" | "center" | "roll" | "pitch" | "throttle" | "yaw" | "done";

export const CAL_SEQUENCE: CalStep[] = ["center", "roll", "pitch", "throttle", "yaw"];

export type CalProgress = {
  step: CalStep;
  /// 0..1 within the current step.
  progress: number;
  /// Axis the wizard believes it just identified.
  detectedAxis: number | null;
  /// Whether that axis has to be inverted to match the expected direction.
  detectedInvert: boolean;
};

/// Observes raw axis samples and works out the mapping.
///
/// ★ Why identify axes by watching rather than trusting a preset: the preset
///   list covers the four published orders, and radios in the wild still miss
///   all four — a Pocket in one firmware revision, a gamepad pretending to be
///   a radio, a Bluetooth stack that reorders axes. Watching which axis moves
///   is the only method that cannot be wrong about the hardware in front of
///   it.
export function createCalibrator(axisCount: number) {
  const centerSum = new Array(axisCount).fill(0);
  const centerMin = new Array(axisCount).fill(Infinity);
  const centerMax = new Array(axisCount).fill(-Infinity);
  let centerSamples = 0;

  const cal: Partial<Record<StickFn, AxisCal>> = {};
  const assign: Partial<Record<StickFn, { axis: number; invert: boolean }>> = {};

  let step: CalStep = "idle";
  let stepSamples = 0;
  let sweepMin = new Array(axisCount).fill(Infinity);
  let sweepMax = new Array(axisCount).fill(-Infinity);
  /// Value of each axis when the sweep step began, so "which moved" is
  /// measured as travel from that point rather than absolute value.
  let sweepStart = new Array(axisCount).fill(0);
  /// Sign of the first real excursion on each axis in this step. Direction
  /// cannot come from min/max: a full sweep reaches both ends whichever way
  /// round the axis is wired, so the extremes are identical either way. What
  /// distinguishes them is which end the pilot reached *first*, following the
  /// prompt.
  let firstDir = new Array(axisCount).fill(0);

  /// Samples needed per step. At 60 fps this is one second to hold centre and
  /// about 1.7 s to sweep a stick — long enough to reach both ends without
  /// feeling like a wait.
  const CENTER_SAMPLES = 60;
  const SWEEP_SAMPLES = 100;
  /// Frames at the start of each sweep during which movement is ignored.
  /// ★ Without this the wizard reads the *previous* stick springing back to
  ///   centre as the next function's movement, and every step after the first
  ///   lands on the same axis. A quarter of a second is enough for a gimbal
  ///   to settle and short enough that nobody notices it.
  const SETTLE_SAMPLES = 18;

  const centerOf = (i: number) =>
    centerSamples > 0 ? centerSum[i] / centerSamples : 0;

  /// Noise floor at rest, widened a little so a twitchy gimbal still rests
  /// at exactly zero. Floored at 1.5% because a perfectly quiet sample run
  /// would otherwise produce a deadband of zero and a drone that drifts on
  /// the faintest touch.
  const noiseOf = (i: number) => {
    const spread = (centerMax[i] - centerMin[i]) / 2;
    return Math.max(0.015, Math.min(0.2, spread * 1.6 + 0.01));
  };

  return {
    get step() {
      return step;
    },

    start() {
      step = "center";
      stepSamples = 0;
      centerSamples = 0;
      centerSum.fill(0);
      centerMin.fill(Infinity);
      centerMax.fill(-Infinity);
    },

    cancel() {
      step = "idle";
    },

    /// Feed one frame of raw axes. Returns where the wizard is now.
    sample(axes: readonly number[]): CalProgress {
      if (step === "idle" || step === "done") {
        return { step, progress: 0, detectedAxis: null, detectedInvert: false };
      }

      if (step === "center") {
        for (let i = 0; i < axisCount; i++) {
          const v = axes[i] ?? 0;
          centerSum[i] += v;
          if (v < centerMin[i]) centerMin[i] = v;
          if (v > centerMax[i]) centerMax[i] = v;
        }
        centerSamples++;
        stepSamples++;
        if (stepSamples >= CENTER_SAMPLES) {
          step = "roll";
          stepSamples = 0;
          sweepMin = axes.map((v) => v);
          sweepMax = axes.map((v) => v);
          sweepStart = axes.map((v) => v);
          firstDir = new Array(axisCount).fill(0);
        }
        return {
          step: "center",
          progress: stepSamples / CENTER_SAMPLES,
          detectedAxis: null,
          detectedInvert: false,
        };
      }

      // Sweep steps.
      stepSamples++;
      if (stepSamples <= SETTLE_SAMPLES) {
        // Still settling: keep re-baselining instead of measuring.
        for (let i = 0; i < axisCount; i++) {
          const v = axes[i] ?? 0;
          sweepStart[i] = v;
          sweepMin[i] = v;
          sweepMax[i] = v;
          firstDir[i] = 0;
        }
        return {
          step,
          progress: stepSamples / SWEEP_SAMPLES,
          detectedAxis: null,
          detectedInvert: false,
        };
      }

      for (let i = 0; i < axisCount; i++) {
        const v = axes[i] ?? 0;
        if (v < sweepMin[i]) sweepMin[i] = v;
        if (v > sweepMax[i]) sweepMax[i] = v;
        if (firstDir[i] === 0 && Math.abs(v - sweepStart[i]) > 0.25) {
          firstDir[i] = v > sweepStart[i] ? 1 : -1;
        }
      }

      // Widest travel wins. Throttle on a ratcheted gimbal barely returns to
      // where it started, so travel is measured as the full min→max range.
      let best = -1;
      let bestTravel = 0;
      for (let i = 0; i < axisCount; i++) {
        const travel = sweepMax[i] - sweepMin[i];
        if (travel > bestTravel) {
          bestTravel = travel;
          best = i;
        }
      }

      // Direction: the prompt asks the pilot to move right / forward / up
      // first, so the first excursion should read positive. If it read
      // negative, the axis is wired backwards.
      const detected = bestTravel > 0.25 ? best : null;
      const invert = detected === null ? false : firstDir[detected] < 0;

      const done = stepSamples >= SWEEP_SAMPLES;
      const progress = stepSamples / SWEEP_SAMPLES;

      if (done) {
        const fn = step as StickFn;
        if (detected !== null) {
          assign[fn] = { axis: detected, invert };
          cal[fn] = {
            min: sweepMin[detected],
            max: sweepMax[detected],
            center: centerOf(detected),
            deadband: noiseOf(detected),
          };
        }
        const next = CAL_SEQUENCE[CAL_SEQUENCE.indexOf(step) + 1];
        step = next ?? "done";
        stepSamples = 0;
        sweepMin = axes.map((v) => v);
        sweepMax = axes.map((v) => v);
        sweepStart = axes.map((v) => v);
        firstDir = new Array(axisCount).fill(0);
      }

      return { step, progress, detectedAxis: detected, detectedInvert: invert };
    },

    /// The map built so far. Anything the wizard failed to see keeps its
    /// value from [base] — a half-finished run must not wipe a working setup.
    result(base: AxisMap): AxisMap {
      const pick = (fn: StickFn, axis: number, inv: boolean) =>
        assign[fn] ?? { axis, invert: inv };
      const r = pick("roll", base.roll, base.invRoll);
      const p = pick("pitch", base.pitch, base.invPitch);
      const t = pick("throttle", base.throttle, base.invThrottle);
      const y = pick("yaw", base.yaw, base.invYaw);
      return {
        roll: r.axis,
        pitch: p.axis,
        throttle: t.axis,
        yaw: y.axis,
        invRoll: r.invert,
        invPitch: p.invert,
        invThrottle: t.invert,
        invYaw: y.invert,
        cal: {
          roll: cal.roll ?? base.cal?.roll ?? NEUTRAL_CAL,
          pitch: cal.pitch ?? base.cal?.pitch ?? NEUTRAL_CAL,
          throttle: cal.throttle ?? base.cal?.throttle ?? NEUTRAL_CAL,
          yaw: cal.yaw ?? base.cal?.yaw ?? NEUTRAL_CAL,
        },
        preset: "custom",
      };
    },

    /// True when every function was identified — the UI should refuse to save
    /// a partial run rather than leave the pilot with two working sticks.
    complete(): boolean {
      return (["roll", "pitch", "throttle", "yaw"] as StickFn[]).every(
        (f) => assign[f] !== undefined,
      );
    },

    /// Two functions on one axis means the pilot moved the wrong stick, and
    /// the result would be unflyable in a way that looks like a broken radio.
    conflicts(): StickFn[] {
      const seen = new Map<number, StickFn>();
      const bad: StickFn[] = [];
      for (const f of ["roll", "pitch", "throttle", "yaw"] as StickFn[]) {
        const a = assign[f]?.axis;
        if (a === undefined) continue;
        const prev = seen.get(a);
        if (prev !== undefined) bad.push(f);
        else seen.set(a, f);
      }
      return bad;
    },
  };
}

/// What to tell the pilot at each step.
export const CAL_PROMPT: Record<CalStep, { en: string; my: string }> = {
  idle: { en: "", my: "" },
  center: {
    en: "Let go of both sticks and keep still",
    my: "stick နှစ်ခုလုံး လွှတ်ထားပြီး မလှုပ်ဘဲ ထားပါ",
  },
  roll: {
    en: "Roll: push the stick fully right, then fully left",
    my: "Roll — stick ကို ညာဘက် အဆုံးထိ၊ ပြီးရင် ဘယ်ဘက် အဆုံးထိ တွန်းပါ",
  },
  pitch: {
    en: "Pitch: push the stick fully forward, then fully back",
    my: "Pitch — stick ကို ရှေ့ အဆုံးထိ၊ ပြီးရင် နောက် အဆုံးထိ တွန်းပါ",
  },
  throttle: {
    en: "Throttle: raise fully, then lower fully",
    my: "Throttle — အပေါ် အဆုံးထိ တင်ပြီး၊ အောက် အဆုံးထိ ချပါ",
  },
  yaw: {
    en: "Yaw: turn the stick fully right, then fully left",
    my: "Yaw — stick ကို ညာဘက် အဆုံးထိ၊ ပြီးရင် ဘယ်ဘက် အဆုံးထိ လှည့်ပါ",
  },
  done: { en: "Calibration complete", my: "ချိန်ညှိမှု ပြီးပါပြီ" },
};
