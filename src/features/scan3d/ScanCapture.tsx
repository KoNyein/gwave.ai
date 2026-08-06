"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCamera } from "@/features/avatar/scan/useCamera";
import { createMeshOverlay } from "./meshOverlay";
import { createOrbitCapture, SECTORS, type OrbitCapture } from "./orbit";
import { saveScan, type ScanMode, type ScanRecord } from "./db";

/// 📡 Pro scan capture UI (room / object) — LiDAR scanner app UX:
/// fullscreen ကင်မရာ + live wireframe mesh + coverage ring + ⏺/⏹ record
/// ခလုတ် + "Pre-Process now?" dialog + processing progress။
///
/// ★ Browser မှာ LiDAR/depth API မရှိလို့ geometry အစစ် မထုတ်နိုင်ဘူး —
///   ဒီ scanner က **orbit capture** ပုံစံ- ပတ်ရိုက်ထားတဲ့ frame ၂၄ ချပ်ကို
///   sector အလိုက် စုပြီး 3D-style orbit viewer နဲ့ ပြန်လှည့်ကြည့်တယ်။
/// ★ ကင်မရာက back camera default — room/object ကို ရိုက်တာမို့။

const MODE_TEXT: Record<ScanMode, { icon: string; title: string; guide: string }> = {
  room: {
    icon: "🏠",
    title: "Room Scan",
    guide: "နေရာတစ်နေရာမှာ ရပ်ပြီး ကိုယ့်ကိုယ်ကို ဖြည်းဖြည်း ၃၆၀° လှည့်ပါ — အခန်းတစ်ပတ် ပြည့်အောင်",
  },
  object: {
    icon: "📦",
    title: "Object Scan",
    guide: "ပစ္စည်းကို အလယ်ထားပြီး သူ့ပတ်လည် ဖြည်းဖြည်း လမ်းလျှောက်ပတ်ပါ — ထောင့်စုံ မိအောင်",
  },
};

type Phase = "intro" | "scanning" | "preprocess" | "processing";

export function ScanCapture({
  mode,
  onDone,
  onExit,
}: {
  mode: ScanMode;
  onDone: (id: string) => void;
  onExit: () => void;
}) {
  const cam = useCamera();
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<OrbitCapture | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;
  const [coverage, setCoverage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const t = MODE_TEXT[mode];

  // rAF loop — mesh overlay + orbit tick + coverage state (~15fps)
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let overlay: ReturnType<typeof createMeshOverlay> | null = null;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 66) return;
      last = now;
      const video = cam.videoRef.current;
      const canvas = overlayRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;
      if (canvas.width !== canvas.clientWidth) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      overlay ??= createMeshOverlay(canvas);
      const capture = captureRef.current;
      const scanning = phaseRef.current === "scanning";
      overlay.draw(video, scanning && (capture?.currentCovered ?? false), now);
      if (scanning && capture) {
        capture.tick(video);
        setCoverage(capture.coverage);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      overlay?.dispose();
    };
  }, [cam.videoRef]);

  useEffect(() => {
    void cam.start("environment");
    return () => {
      cam.stop();
      captureRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScan = useCallback(async () => {
    const capture = createOrbitCapture();
    captureRef.current = capture;
    await capture.start();
    setCoverage(0);
    setPhase("scanning");
  }, []);

  const stopScan = useCallback(() => {
    captureRef.current?.stop();
    if ((captureRef.current?.count ?? 0) === 0) {
      setErr("Frame မမိသေးပါ — နောက်တစ်ခါ ဖြည်းဖြည်း လှည့်ရိုက်ကြည့်ပါ");
      setPhase("intro");
      return;
    }
    setPhase("preprocess");
  }, []);

  /// "Continue" — frames တွေကို scan record အဖြစ် စု၊ progress ပြပြီး သိမ်း
  const preprocess = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return;
    setPhase("processing");
    setProgress(0.1);
    try {
      const frames = capture.frames();
      // progress က UX အတွက် — အလုပ်အစစ်က blob စုထားပြီးသားမို့ မြန်တယ်
      await new Promise((r) => setTimeout(r, 350));
      setProgress(0.55);
      const rec: ScanRecord = {
        id: crypto.randomUUID(),
        mode,
        name: `${t.title} ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        frames,
        cover: frames[Math.floor(frames.length / 2)]?.blob ?? null,
      };
      await saveScan(rec);
      setProgress(1);
      await new Promise((r) => setTimeout(r, 250));
      onDone(rec.id);
    } catch {
      setErr("သိမ်းလို့ မရဘူး — storage နေရာ စစ်ပြီး ပြန်ကြိုးစားပါ");
      setPhase("intro");
    }
  }, [mode, onDone, t.title]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* top bar — reference app style */}
      <div className="z-10 flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onExit} className="px-2 text-lg text-white/80">‹</button>
        <span className="text-sm font-semibold">{t.icon} {t.title}</span>
        <span className="px-2 text-white/40">ⓘ</span>
      </div>

      {/* camera + wireframe overlay */}
      <div className="relative min-h-0 flex-1">
        <video
          ref={cam.videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />

        {phase === "scanning" && (
          <>
            {/* coverage ring — ဘယ်လောက် ပတ်ပြီးပြီလဲ */}
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-white backdrop-blur">
              🧭 {Math.round(coverage * 100)}% ({Math.round(coverage * SECTORS)}/{SECTORS})
            </div>
            <div className="absolute inset-x-6 top-12">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${coverage * 100}%` }}
                />
              </div>
            </div>
          </>
        )}

        {phase === "intro" && cam.state === "on" && (
          <div className="absolute inset-x-6 bottom-32 rounded-2xl bg-black/65 p-4 text-center text-sm text-white backdrop-blur">
            {t.guide}
          </div>
        )}
        {cam.state === "denied" && (
          <div className="absolute inset-x-6 top-1/3 rounded-2xl bg-black/70 p-4 text-center text-sm text-red-300">
            ကင်မရာခွင့် မရပါ — browser/app settings မှာ camera ခွင့်ပြုပြီး ပြန်ဖွင့်ပါ
          </div>
        )}
        {err && (
          <div className="absolute inset-x-6 top-1/4 rounded-2xl bg-red-500/20 p-3 text-center text-xs text-red-200">
            ⚠️ {err}
          </div>
        )}
      </div>

      {/* record / stop — reference app ရဲ့ ဝိုင်းကြီး ခလုတ် */}
      <div className="flex items-center justify-center py-6">
        {phase === "intro" && (
          <button
            onClick={() => void startScan()}
            disabled={cam.state !== "on"}
            aria-label="Scan စမယ်"
            className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white/90 p-1 disabled:opacity-40"
            style={{ width: 72, height: 72 }}
          >
            <span className="block h-full w-full rounded-full bg-red-500" />
          </button>
        )}
        {phase === "scanning" && (
          <button
            onClick={stopScan}
            aria-label="Scan ရပ်မယ်"
            className="flex items-center justify-center rounded-full border-4 border-white/90"
            style={{ width: 72, height: 72 }}
          >
            <span className="block rounded-md bg-white" style={{ width: 26, height: 26 }} />
          </button>
        )}
      </div>

      {/* Pre-process dialog — reference app ရဲ့ "Do the Pre-Process now?" */}
      {phase === "preprocess" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 px-8">
          <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-zinc-800 text-center">
            <p className="px-4 pb-4 pt-5 text-base font-semibold text-white">
              Pre-Process လုပ်မလား?
            </p>
            <div className="grid grid-cols-2 border-t border-white/10">
              <button
                onClick={() => {
                  captureRef.current?.dispose();
                  setPhase("intro");
                }}
                className="border-r border-white/10 py-3 text-sm text-sky-400"
              >
                Exit
              </button>
              <button onClick={() => void preprocess()} className="py-3 text-sm font-semibold text-sky-400">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* processing progress */}
      {phase === "processing" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 px-10">
          <p className="text-sm text-white">⚙️ Process လုပ်နေသည်…</p>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
