"use client";

import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

/// 🧍 MediaPipe PoseLandmarker wrapper (spec §5) — singleton + lazy,
/// faceLandmarks.ts နဲ့ ပုံစံတူ။ Model က self-host (lite variant — ဖုန်း
/// mid-range မှာ မြန်ပြီး measurement ratio အတွက် လုံလောက်တယ်)။

let instance: PoseLandmarker | null = null;
let loading: Promise<PoseLandmarker> | null = null;

export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "/mediapipe/wasm",
      );
      instance = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      return instance;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

/// Pose landmark indices (MediaPipe 33-point)
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;
const NOSE = 0;

const KEY_POINTS = [
  L_SHOULDER,
  R_SHOULDER,
  L_ELBOW,
  R_ELBOW,
  L_WRIST,
  R_WRIST,
  L_HIP,
  R_HIP,
  L_KNEE,
  R_KNEE,
  L_ANKLE,
  R_ANKLE,
];

export type BodyMeasurements = {
  /// အားလုံး "landmark height" (နှာခေါင်း→ခြေမျက်စိ) ကို စံထားတဲ့ ratio များ
  shoulderRatio: number;
  hipRatio: number;
  torsoRatio: number;
  armRatio: number;
  legRatio: number;
};

function dist(a: NormalizedLandmark, b: NormalizedLandmark, aspect: number) {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function mid(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

/// ── Live overlay support (Scanner v2) ────────────────────────────────
/// Skeleton bones for the camera-step overlay — the user must SEE that the
/// tracker has their whole body before capture makes sense.
export const POSE_BONES: ReadonlyArray<readonly [number, number]> = [
  [L_SHOULDER, R_SHOULDER],
  [L_SHOULDER, L_ELBOW],
  [L_ELBOW, L_WRIST],
  [R_SHOULDER, R_ELBOW],
  [R_ELBOW, R_WRIST],
  [L_SHOULDER, L_HIP],
  [R_SHOULDER, R_HIP],
  [L_HIP, R_HIP],
  [L_HIP, L_KNEE],
  [L_KNEE, L_ANKLE],
  [R_HIP, R_KNEE],
  [R_KNEE, R_ANKLE],
];

export type LivePose = {
  points: NormalizedLandmark[];
  /// All key landmarks visible enough to measure.
  ready: boolean;
};

/// One lightweight detection for the live overlay loop. Null = no person.
export async function detectPose(
  video: HTMLVideoElement,
): Promise<LivePose | null> {
  const lm = await getPoseLandmarker();
  const res = lm.detectForVideo(video, performance.now());
  const p = res.landmarks?.[0];
  if (!p) return null;
  const ready = KEY_POINTS.every((i) => ((p[i]?.visibility ?? 0) >= 0.7));
  return { points: p, ready };
}

/// Frame တစ်ချပ်က measurement ratio ထုတ် — မပြည့်စုံရင် error string။
/// aspect = width/height — normalized coords ကို axis ညီအောင် ပြန်ချဲ့တယ်။
export async function captureBody(
  video: HTMLVideoElement,
): Promise<BodyMeasurements | { error: string }> {
  const lm = await getPoseLandmarker();
  const res = lm.detectForVideo(video, performance.now());
  const poses = res.landmarks;
  if (!poses || poses.length === 0) {
    return { error: "ကိုယ်ခန္ဓာ မတွေ့ပါ — 2-3 မီတာ ခွာပြီး တစ်ကိုယ်လုံး ပေါ်အောင် ရပ်ပါ" };
  }
  const p = poses[0];
  if (!p) return { error: "ကိုယ်ခန္ဓာ မတွေ့ပါ" };

  // Confidence gate (spec §5.1) — key landmark visibility > 0.7
  for (const i of KEY_POINTS) {
    const pt = p[i];
    if (!pt || (pt.visibility ?? 0) < 0.7) {
      return {
        error:
          "ခန္ဓာကိုယ် အပြည့် မမြင်ရပါ — လက်ခြေအားလုံး frame ထဲ ပေါ်အောင် ရပ်ပြီး အလင်းကောင်းကောင်းထားပါ",
      };
    }
  }

  const aspect = video.videoWidth / Math.max(1, video.videoHeight);
  const ls = p[L_SHOULDER]!;
  const rs = p[R_SHOULDER]!;
  const lh = p[L_HIP]!;
  const rh = p[R_HIP]!;
  const nose = p[NOSE]!;
  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);
  const ankleMid = mid(p[L_ANKLE]!, p[R_ANKLE]!);

  // Landmark height — နှာခေါင်းကနေ ခြေမျက်စိ (~ အရပ်ရဲ့ 93%)
  const bodyH = dist(nose, ankleMid, aspect);
  if (bodyH < 0.35) {
    return { error: "နည်းနည်း ခွာပါ — တစ်ကိုယ်လုံး frame ထဲ မဆန့်သေးပါ" };
  }

  const armL =
    dist(ls, p[L_ELBOW]!, aspect) + dist(p[L_ELBOW]!, p[L_WRIST]!, aspect);
  const armR =
    dist(rs, p[R_ELBOW]!, aspect) + dist(p[R_ELBOW]!, p[R_WRIST]!, aspect);
  const legL =
    dist(lh, p[L_KNEE]!, aspect) + dist(p[L_KNEE]!, p[L_ANKLE]!, aspect);
  const legR =
    dist(rh, p[R_KNEE]!, aspect) + dist(p[R_KNEE]!, p[R_ANKLE]!, aspect);

  return {
    shoulderRatio: dist(ls, rs, aspect) / bodyH,
    hipRatio: dist(lh, rh, aspect) / bodyH,
    torsoRatio: dist(shoulderMid, hipMid, aspect) / bodyH,
    armRatio: (armL + armR) / 2 / bodyH,
    legRatio: (legL + legR) / 2 / bodyH,
  };
}

/// ── Measurements → morph weights (spec §5.2) ─────────────────────────
/// Reference ratio တွေက ပျမ်းမျှလူ (anthropometric averages) — measured
/// ratio ကို reference နဲ့ နှိုင်းပြီး [-1,1] morph weight ထုတ်တယ်။
/// Sensitivity ~±25% ကို full-range လို့ သတ်မှတ်။
const REF = {
  shoulderRatio: 0.26,
  hipRatio: 0.19,
  torsoRatio: 0.31,
  armRatio: 0.44,
  legRatio: 0.52,
};

function toWeight(measured: number, ref: number): number {
  const w = (measured / ref - 1) / 0.25;
  return Math.max(-1, Math.min(1, Number.isFinite(w) ? w : 0));
}

export function measurementsToMorphs(
  m: BodyMeasurements,
  heightCm: number | null,
): Record<string, number> {
  const out: Record<string, number> = {
    shoulderWidth: toWeight(m.shoulderRatio, REF.shoulderRatio),
    hips: toWeight(m.hipRatio, REF.hipRatio),
    waist: toWeight(m.hipRatio, REF.hipRatio) * 0.6, // ခါးက တင်ပါးနဲ့ ဆက်စပ် — side capture (နောက် phase) ရမှ တိကျမယ်
    armLength: toWeight(m.armRatio, REF.armRatio),
    legLength: toWeight(m.legRatio, REF.legRatio),
  };
  // အရပ် — user ထည့်တဲ့ cm (recommended, spec §5.1)။ 145–195cm → [-1,1]
  if (heightCm && heightCm >= 120 && heightCm <= 220) {
    out.height = Math.max(-1, Math.min(1, (heightCm - 170) / 25));
  }
  return out;
}
