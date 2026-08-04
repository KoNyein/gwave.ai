"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { buildFaceMesh, type BuiltFace } from "../build/faceMeshBuilder";
import { exportGlb, uploadScanFile } from "../build/glbExport";
import { captureFace } from "./faceLandmarks";
import { useCamera } from "./useCamera";

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
  const { videoRef, state: camState, start, stop } = useCamera();
  const [step, setStep] = useState<Step>("consent");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const builtRef = useRef<BuiltFace | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

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
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      const cap = await captureFace(v);
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
              {/* Selfie preview — mirror ပြ (မြင်နေကျ ပုံစံ) */}
              <video
                ref={videoRef}
                className="aspect-[3/4] w-full -scale-x-100 object-cover"
              />
              {/* Oval guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[70%] w-[62%] rounded-[50%] border-2 border-dashed border-emerald-400/70" />
              </div>
              {camState !== "on" && (
                <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/60">
                  {camState === "starting" ? "ကင်မရာ ဖွင့်နေသည်…" : "ကင်မရာ မရသေးပါ"}
                </p>
              )}
            </div>
            <p className="text-center text-[12px] text-white/60">
              မျက်နှာကို ဘဲဥကွင်းထဲ တည့်တည့်ထား၊ အလင်းကောင်းကောင်းနဲ့
            </p>
            <button
              onClick={snap}
              disabled={busy || camState !== "on"}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
            >
              {busy ? "ဖမ်းနေသည်…" : "📸 ဖမ်းမယ်"}
            </button>
          </div>
        )}

        {(step === "preview" || step === "uploading") && (
          <div className="space-y-3">
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
