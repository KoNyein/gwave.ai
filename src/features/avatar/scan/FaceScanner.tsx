"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { buildFaceMesh, type BuiltFace } from "../build/faceMeshBuilder";
import { exportGlb, uploadScanFile } from "../build/glbExport";
import { captureFaceStable, getFaceLandmarker } from "./faceLandmarks";
import { useCamera } from "./useCamera";
import { RecordButton } from "@/features/scan3d/RecordButton";

import { applyGpuBudget, gpuRendererOptions } from "@/lib/gpu-budget";

/// 📷 Face Scanner modal (spec §4.1) — Phase 2 v1: front capture။
///
/// Flow: consent → camera → capture (quality gates) → 3D preview →
/// upload (glb + thumb) → onDone(urls)။
///
/// ★ Consent (spec §10) — biometric data မို့ scan မစခင် သဘောတူချက်
///   အရင်ယူတယ်၊ server (POST /api/avatar/consent) မှာ မှတ်တယ် —
///   upload presign က ဒါမရှိရင် 403 ပြန်တယ်။
/// ★ Processing အားလုံး ဖုန်းထဲမှာပဲ — frame တွေ server မတက်ဘူး၊
///   နောက်ဆုံး GLB/thumbnail ပဲ တက်တယ်။
/// ★ Left/Right capture (multi-view texture bake) က Phase 2b — ဒီ v1 က
///   front တစ်ချက်နဲ့ likeness ရပြီ၊ pipeline တစ်လျှောက် အလုပ်လုပ်တယ်။

type Step = "consent" | "camera" | "preview" | "uploading" | "done";

export function FaceScanner({
  onDone,
  onClose,
}: {
  onDone: (r: { faceGlbUrl: string; faceThumbUrl: string }) => void;
  onClose: () => void;
}) {
  const {
    videoRef,
    state: camState,
    facing,
    start,
    stop,
    flip,
    torchSupported,
    torchOn,
    setTorch,
  } = useCamera();
  // mirror only the selfie camera — a mirrored back camera reads backwards
  const mirror = facing === "user" ? " -scale-x-100" : "";
  const [step, setStep] = useState<Step>("consent");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const builtRef = useRef<BuiltFace | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  /// AR overlay: live face mesh + auto-capture progress ring
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [hint, setHint] = useState("🧠 Scan engine ဖွင့်နေသည်…");
  const busyRef = useRef(false);
  busyRef.current = busy;
  const snapRef = useRef<() => void>(() => undefined);

  // ── 3D preview (capture ပြီးမှ) ─────────────────────────────────────────
  useEffect(() => {
    if (step !== "preview" || !previewRef.current || !builtRef.current) return;
    const mount = previewRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    const camera = new THREE.PerspectiveCamera(
      35,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.01,
      10,
    );
    camera.position.set(0, 0, 0.35);
    const renderer = new THREE.WebGLRenderer(gpuRendererOptions());
    applyGpuBudget(renderer);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(0.3, 0.5, 1);
    scene.add(key);
    const holder = new THREE.Group();
    holder.add(builtRef.current.mesh);
    scene.add(holder);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // 🔋 မမြင်ရချိန် frame မပုံဖော်ဘူး (WebView/PWA မှာ rAF က မရပ်ဘူး)
      if (document.hidden) return;
      holder.rotation.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.6;
      renderer.render(scene, camera);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [step]);

  useEffect(() => stop, [stop]);

  // ── AR scanning overlay (camera step) ──────────────────────────────────
  // The same MediaPipe singleton the capture uses runs live (~15fps): the
  // detected mesh is drawn over the face, quality gates (found / close
  // enough / centered / steady) drive a Face-ID-style progress ring, and a
  // full ring auto-captures. The manual 📸 button stays as the fallback.
  useEffect(() => {
    if (step !== "camera") return;
    let raf = 0;
    let stopped = false;
    let lastTs = 0;
    let progress = 0;
    let steadyFrames = 0;
    let lastNose: { x: number; y: number } | null = null;
    let lastHint = "";
    const say = (h: string) => {
      if (h !== lastHint) {
        lastHint = h;
        setHint(h);
      }
    };
    void (async () => {
      const lm = await getFaceLandmarker().catch(() => null);
      if (!lm || stopped) {
        if (!lm) say("⚠️ Scan engine ဆွဲလို့မရပါ — network စစ်ပြီး ပြန်ဝင်ပါ");
        return;
      }
      const vision = await import("@mediapipe/tasks-vision");
      const edges = vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION;
      const loop = (ts: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(loop);
        const v = videoRef.current;
        const cv = overlayRef.current;
        if (!v || !cv || v.videoWidth === 0 || busyRef.current) return;
        if (ts - lastTs < 66) return; // ~15fps — phone GPU/battery friendly
        const dt = Math.min(0.2, (ts - lastTs) / 1000);
        lastTs = ts;
        if (cv.width !== v.videoWidth || cv.height !== v.videoHeight) {
          cv.width = v.videoWidth;
          cv.height = v.videoHeight;
        }
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const W = cv.width;
        const H = cv.height;
        ctx.clearRect(0, 0, W, H);

        let pts: { x: number; y: number }[] | undefined;
        try {
          pts = lm.detectForVideo(v, performance.now()).faceLandmarks?.[0];
        } catch {
          return;
        }

        // ── Gates + hint (first failing gate wins) ──
        let ok = false;
        if (!pts) {
          say("🔍 မျက်နှာ ရှာနေသည် — ကင်မရာရှေ့ တည့်တည့်ထားပါ");
          steadyFrames = 0;
        } else {
          let minX = 1, maxX = 0, minY = 1, maxY = 0;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const nose = pts[1] ?? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
          if (lastNose) {
            const d = Math.hypot(nose.x - lastNose.x, nose.y - lastNose.y);
            steadyFrames = d < 0.012 ? steadyFrames + 1 : 0;
          }
          lastNose = { x: nose.x, y: nose.y };

          if (maxY - minY < 0.3) {
            say("↔️ နည်းနည်း တိုးကပ်ပါ — မျက်နှာက ဝေးနေသေးတယ်");
          } else if (nose.x < 0.3 || nose.x > 0.7 || nose.y < 0.25 || nose.y > 0.75) {
            say("🎯 မျက်နှာကို အလယ်ကို ရွှေ့ပါ");
          } else if (steadyFrames < 3) {
            say("✋ ဖုန်းနဲ့ ခေါင်း ငြိမ်ငြိမ်ထားပါ");
          } else {
            ok = true;
            say(`✨ ဖမ်းနေပြီ — ငြိမ်ငြိမ်နေပါ (${Math.round(progress * 100)}%)`);
          }

          // ── AR mesh (mirrored by CSS with the video) ──
          ctx.strokeStyle = ok
            ? "rgba(52,211,153,0.45)"
            : "rgba(148,163,184,0.30)";
          ctx.lineWidth = Math.max(1, W / 640);
          ctx.beginPath();
          for (let i = 0; i < edges.length; i += 2) {
            const e = edges[i];
            if (!e) continue;
            const a = pts[e.start];
            const b = pts[e.end];
            if (!a || !b) continue;
            ctx.moveTo(a.x * W, a.y * H);
            ctx.lineTo(b.x * W, b.y * H);
          }
          ctx.stroke();
          ctx.fillStyle = ok ? "rgba(110,231,183,0.9)" : "rgba(203,213,225,0.6)";
          for (let i = 0; i < pts.length; i += 8) {
            const p = pts[i];
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x * W, p.y * H, Math.max(1.2, W / 500), 0, Math.PI * 2);
            ctx.fill();
          }

          // ── Progress ring around the face + scan sweep ──
          const cx = ((minX + maxX) / 2) * W;
          const cy = ((minY + maxY) / 2) * H;
          const rx = ((maxX - minX) / 2) * W * 1.25;
          const ry = ((maxY - minY) / 2) * H * 1.15;
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.lineWidth = Math.max(3, W / 160);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (progress > 0) {
            ctx.strokeStyle = "rgba(52,211,153,0.95)";
            ctx.beginPath();
            ctx.ellipse(
              cx, cy, rx, ry, 0,
              -Math.PI / 2,
              -Math.PI / 2 + progress * Math.PI * 2,
            );
            ctx.stroke();
            const sweepY = cy - ry + ((performance.now() / 900) % 1) * ry * 2;
            const g = ctx.createLinearGradient(0, sweepY - 14, 0, sweepY + 14);
            g.addColorStop(0, "rgba(52,211,153,0)");
            g.addColorStop(0.5, "rgba(52,211,153,0.35)");
            g.addColorStop(1, "rgba(52,211,153,0)");
            ctx.fillStyle = g;
            ctx.fillRect(cx - rx, sweepY - 14, rx * 2, 28);
          }
        }

        progress = ok
          ? Math.min(1, progress + dt / 1.3)
          : Math.max(0, progress - dt * 1.6);
        if (progress >= 1) {
          progress = 0;
          say("📸 ဖမ်းလိုက်ပြီ…");
          snapRef.current();
        }
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [step, videoRef]);

  const consent = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/avatar/consent", { method: "POST" });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d?.error ?? "သဘောတူချက် သိမ်းလို့ မရပါ");
      }
      setStep("camera");
      const ok = await start();
      if (!ok) setErr("ကင်မရာခွင့် မရပါ — browser/app settings မှာ ခွင့်ပြုပေးပါ");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "မအောင်မြင်ပါ");
    } finally {
      setBusy(false);
    }
  };

  const snap = async () => {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Multi-frame HQ capture — landmark ပျမ်းမျှ + sharpest frame texture
      const cap = await captureFaceStable(v, (d, t) =>
        setHint(`📸 Frame ${d}/${t} ဖမ်းနေသည် — ငြိမ်ငြိမ်နေပါ`),
      );
      if ("error" in cap) {
        setErr(cap.error);
        return;
      }
      builtRef.current = await buildFaceMesh(cap);
      stop();
      setStep("preview");
    } catch (e) {
      setErr(
        e instanceof Error && e.message
          ? e.message
          : "Scan engine ဆွဲလို့မရပါ — network စစ်ပြီး ပြန်ကြိုးစားပါ",
      );
    } finally {
      setBusy(false);
    }
  };

  // The AR loop auto-captures through this ref so it always calls the
  // freshest closure (busy/camera state included).
  snapRef.current = () => void snap();

  const upload = async () => {
    const built = builtRef.current;
    if (!built || busy) return;
    setBusy(true);
    setErr(null);
    setStep("uploading");
    try {
      const glbBlob = await exportGlb(built.mesh);
      // Thumbnail — texture canvas ကို 256² ချုံ့
      const thumb = document.createElement("canvas");
      thumb.width = 256;
      thumb.height = 256;
      thumb.getContext("2d")?.drawImage(built.texture, 0, 0, 256, 256);
      const thumbBlob = await new Promise<Blob>((res, rej) =>
        thumb.toBlob((b) => (b ? res(b) : rej(new Error("thumb"))), "image/png"),
      );
      const [faceGlbUrl, faceThumbUrl] = await Promise.all([
        uploadScanFile("scan-face.glb", glbBlob),
        uploadScanFile("thumb.png", thumbBlob),
      ]);
      setStep("done");
      onDone({ faceGlbUrl, faceThumbUrl });
    } catch (e) {
      setStep("preview");
      setErr(e instanceof Error ? e.message : "Upload မအောင်မြင်ပါ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d1220] p-4 text-white">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">📷 မျက်နှာ 3D Scan</h2>
          <button
            onClick={() => {
              stop();
              onClose();
            }}
            className="rounded-full px-2 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        {step === "consent" && (
          <div className="space-y-3 text-[13px] leading-relaxed text-white/80">
            <p>
              မျက်နှာ scan က <b>ဇီဝအချက်အလက် (biometric)</b> ဖြစ်ပါတယ်။
            </p>
            <ul className="list-disc space-y-1 pl-5 text-white/65">
              <li>ကင်မရာ frame တွေကို ဖုန်းထဲမှာပဲ process လုပ်ပါတယ် — server ကို မတက်ပါ</li>
              <li>နောက်ဆုံးထွက် 3D file နဲ့ ပုံသေးပဲ upload တက်ပါတယ်</li>
              <li>ဘယ်အချိန်မဆို「Scan ဖျက်မယ်」နဲ့ အပြီး ဖျက်လို့ရပါတယ်</li>
            </ul>
            <button
              onClick={consent}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              {busy ? "…" : "သဘောတူပါတယ် — Scan စတင်မယ်"}
            </button>
          </div>
        )}

        {step === "camera" && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              {/* Preview — selfie ကင်မရာမှသာ mirror ပြ (မြင်နေကျ ပုံစံ) */}
              <video
                ref={videoRef}
                className={`aspect-[3/4] w-full object-cover${mirror}`}
              />
              {/* AR overlay: live face mesh + progress ring + scan sweep —
                  same mirror + cover crop as the video so it stays aligned */}
              <canvas
                ref={overlayRef}
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover${mirror}`}
              />
              {/* Camera controls: 🔁 front/back (တခြားသူက ရိုက်ပေးရင် back
                  camera က ပိုကြည်တယ်), 🔦 torch when the device has one */}
              <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
                <button
                  onClick={() => void flip()}
                  disabled={busy}
                  title={facing === "user" ? "နောက်ကင်မရာ" : "ရှေ့ကင်မရာ"}
                  className="rounded-full border border-white/25 bg-black/50 px-2.5 py-2 text-base backdrop-blur-sm disabled:opacity-40"
                >
                  🔁
                </button>
                {torchSupported && (
                  <button
                    onClick={() => void setTorch(!torchOn)}
                    title="ဓာတ်မီး"
                    className={`rounded-full border px-2.5 py-2 text-base backdrop-blur-sm ${
                      torchOn
                        ? "border-amber-300 bg-amber-400/80"
                        : "border-white/25 bg-black/50"
                    }`}
                  >
                    🔦
                  </button>
                )}
              </div>
              {/* Corner brackets — scanner-viewfinder framing */}
              <div className="pointer-events-none absolute inset-3">
                <div className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-emerald-400/80" />
                <div className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-emerald-400/80" />
                <div className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-emerald-400/80" />
                <div className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-emerald-400/80" />
              </div>
              {camState !== "on" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center">
                  {camState === "starting" ? (
                    <p className="text-sm text-white/80">📷 ကင်မရာ ဖွင့်နေသည်…</p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-amber-300">
                        ကင်မရာ ဖွင့်လို့ မရသေးပါ
                      </p>
                      <p className="text-[12px] leading-relaxed text-white/70">
                        ခွင့်ပြုချက် တောင်းလာရင်「ခွင့်ပြု / Allow」နှိပ်ပါ။
                        ငြင်းမိသွားရင် ဖုန်း Settings → Apps → Gwave →
                        Permissions → Camera ကို ဖွင့်ပြီး ပြန်ကြိုးစားပါ။
                      </p>
                      <button
                        onClick={() => void start()}
                        className="rounded-lg bg-emerald-500 px-4 py-1.5 text-[13px] font-semibold text-black"
                      >
                        🔄 ပြန်ကြိုးစားမယ်
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Live AR guidance — updates every frame from the mesh gates */}
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-[13.5px] font-semibold text-emerald-200">
              {hint}
            </p>
            <div className="rounded-lg bg-white/5 p-2.5 text-[12.5px] leading-relaxed text-white/75">
              💡 <b>ကောင်းကောင်းရအောင်</b>: အလင်းရောင် ကောင်းကောင်း
              (ပြတင်းပေါက်/မီးရှေ့) · မျက်မှန်/ဦးထုပ် ချွတ်ထား · ဖုန်းကို
              မျက်နှာအမြင့် တည့်တည့်ကိုင် — အဆင်ပြေရင် <b>အလိုအလျောက် ဖမ်းပေး</b>ပါမယ်
            </div>
            {/* ⏺ Pro-scanner record ခလုတ် — scanner suite တစ်ပုံစံတည်း */}
            <div className="flex justify-center pt-1">
              <RecordButton
                onClick={snap}
                disabled={busy || camState !== "on"}
                label={busy ? "ဖမ်းနေသည်…" : "📸 ဖမ်းမယ်"}
              />
            </div>
          </div>
        )}

        {(step === "preview" || step === "uploading") && (
          <div className="space-y-3">
            <p className="text-center text-[13px] text-white/80">
              ✨ ကိုယ့် 3D မျက်နှာပါ — ကြိုက်ရင် ✓ သုံးမယ်၊ မကြိုက်ရင် ပြန်ရိုက်ပါ
            </p>
            <div ref={previewRef} className="aspect-[3/4] w-full overflow-hidden rounded-xl" />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  builtRef.current = null;
                  setStep("camera");
                  void start();
                }}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/80"
              >
                ပြန်ရိုက်မယ်
              </button>
              <button
                onClick={upload}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                {step === "uploading" ? "တင်နေသည်…" : "✓ သုံးမယ်"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <p className="py-6 text-center text-sm text-emerald-300">
            ✓ Scan ပြီးပါပြီ — avatar မှာ တပ်ပြီးပါပြီ
          </p>
        )}

        {err && (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">
            ⚠️ {err}
          </p>
        )}
      </div>
    </div>
  );
}
