"use client";

import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/// 🧠 MediaPipe FaceLandmarker wrapper — **singleton + lazy** (spec §13:
/// per-frame ပြန်ဆောက်ရင် WASM memory ယိုတယ်)။
///
/// ★ WASM နဲ့ model ကို **self-host** (public/mediapipe/…) — CDN ပေါ်
///   မမှီခိုဘူး၊ offline-ish မြန်မာ network မှာလည်း တည်ငြိမ်တယ်။
/// ★ Import က dynamic — scanner မဖွင့်တဲ့သူ ဘယ်သူမှ WASM ~12MB မဆွဲရဘူး။

let instance: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "/mediapipe/wasm",
      );
      instance = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe/models/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      return instance;
    })().catch((err) => {
      loading = null; // နောက်တစ်ခါ ပြန်ကြိုးစားလို့ရအောင်
      throw err;
    });
  }
  return loading;
}

/// Canonical face mesh ရဲ့ triangle list — TESSELATION edge list ကနေ
/// 3-clique တွေ ရှာပြီး တစ်ခါတည်း တွက်တယ် (mediapipe က triangle list
/// မထုတ်ပေးဘူး)။ ~850 triangles — millisecond အနည်းငယ်ပဲ ကြာတယ်။
let triangleCache: number[] | null = null;

export async function getFaceTriangles(): Promise<number[]> {
  if (triangleCache) return triangleCache;
  const vision = await import("@mediapipe/tasks-vision");
  const edges = vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    let s = adj.get(a);
    if (!s) {
      s = new Set();
      adj.set(a, s);
    }
    s.add(b);
  };
  for (const e of edges) {
    link(e.start, e.end);
    link(e.end, e.start);
  }
  const tris: number[] = [];
  for (const e of edges) {
    const a = Math.min(e.start, e.end);
    const b = Math.max(e.start, e.end);
    const na = adj.get(a);
    const nb = adj.get(b);
    if (!na || !nb) continue;
    for (const c of na) {
      // c > b — triangle တစ်ခုကို edge ၃ ခုစလုံးက ထပ်မထည့်အောင်
      if (c > b && nb.has(c)) tris.push(a, b, c);
    }
  }
  triangleCache = tris;
  return tris;
}

export type FaceCapture = {
  landmarks: NormalizedLandmark[];
  /// ဖမ်းချိန်က video frame (texture အတွက်)
  frame: HTMLCanvasElement;
  width: number;
  height: number;
};

/// Frame တစ်ချပ်မှာ မျက်နှာရှာ — quality gate တွေပါ စစ်ပြီး အဆင်ပြေမှ
/// capture ပြန်ပေးတယ် (မပြေရင် reason string)
export async function captureFace(
  video: HTMLVideoElement,
): Promise<FaceCapture | { error: string }> {
  const lm = await getFaceLandmarker();
  const res = lm.detectForVideo(video, performance.now());
  const faces = res.faceLandmarks;
  if (!faces || faces.length === 0) {
    return { error: "မျက်နှာ မတွေ့ပါ — ကင်မရာရှေ့ တည့်တည့်ထားပါ" };
  }
  if (faces.length > 1) {
    return { error: "မျက်နှာ တစ်ခုတည်း ဖြစ်ရပါမယ်" };
  }
  const pts = faces[0];
  if (!pts) return { error: "မျက်နှာ မတွေ့ပါ" };

  // မျက်နှာအရွယ် gate — frame အမြင့်ရဲ့ 30%+ (spec: 40%၊ ဖုန်းအမျိုးမျိုးမှာ
  // စမ်းသပ်ချက်အရ နည်းနည်း ဖြေလျှော့)
  let minY = 1;
  let maxY = 0;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (maxY - minY < 0.3) {
    return { error: "နည်းနည်း တိုးကပ်ပါ — မျက်နှာက သေးနေသေးတယ်" };
  }

  // အလင်း gate — မျက်နှာဧရိယာရဲ့ ပျမ်းမျှ luma
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return { error: "ကင်မရာ မအဆင်သင့်သေးပါ" };
  const frame = document.createElement("canvas");
  frame.width = w;
  frame.height = h;
  const c = frame.getContext("2d");
  if (!c) return { error: "Canvas မရပါ" };
  c.drawImage(video, 0, 0, w, h);
  const sample = c.getImageData(
    Math.floor(w * 0.35),
    Math.floor(h * (minY + (maxY - minY) * 0.3)),
    Math.max(1, Math.floor(w * 0.3)),
    Math.max(1, Math.floor(h * 0.2)),
  );
  let luma = 0;
  for (let i = 0; i < sample.data.length; i += 4) {
    luma +=
      0.299 * (sample.data[i] ?? 0) +
      0.587 * (sample.data[i + 1] ?? 0) +
      0.114 * (sample.data[i + 2] ?? 0);
  }
  luma /= sample.data.length / 4;
  if (luma < 60) return { error: "အလင်း မလုံလောက်ပါ — လင်းတဲ့နေရာမှာ ရိုက်ပါ" };
  if (luma > 235) return { error: "အလင်း ပြင်းလွန်းတယ် — နေရောင်တည့်တည့် ရှောင်ပါ" };

  return { landmarks: pts, frame, width: w, height: h };
}
