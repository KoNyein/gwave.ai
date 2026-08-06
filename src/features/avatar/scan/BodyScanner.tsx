"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AvatarPreview } from "../editor/AvatarPreview";
import {
  captureBody,
  detectPose,
  measurementsToMorphs,
  POSE_BONES,
} from "./poseLandmarks";
import { useCamera } from "./useCamera";
import { RecordButton } from "@/features/scan3d/RecordButton";
import {
  DEFAULT_SCAN_AVATAR,
  MORPH_LABELS,
  sanitizeMorphs,
  type MorphKey,
  type MorphWeights,
} from "../types";

/// 🧍 Body Scanner modal (spec §5.1) — v2။
///
/// v1 complaint-driven rewrite: "mesh မပါဘူး၊ UI/UX အဆင့်မမှီဘူး"။
/// ★ Camera step — MediaPipe pose ကို LIVE ဆွဲပြတယ် (skeleton overlay)၊
///   တစ်ကိုယ်လုံး မိရင် အစိမ်း / မမိရင် လိမ္မော် — မြင်သာတဲ့ feedback။
/// ★ ⏱ 5s timer capture — ဖုန်းထောင်ပြီး နောက်ဆုတ်ရတဲ့ တစ်ယောက်တည်း
///   scan မှာ ခလုတ်နှိပ်ရင်း frame ထဲ မဝင်နိုင်တဲ့ ပြဿနာ ဖြေ။
/// ★ Result step — ကိန်းဂဏန်း list အစား 3D mesh preview (morph တွေ
///   ချက်ချင်း သက်ရောက်ပြီးသား) + မြန်မာလို label တပ်ထားတဲ့ bar များ။

type Step = "guide" | "camera" | "result";

export function BodyScanner({
  onApply,
  onClose,
}: {
  onApply: (morphs: MorphWeights) => void;
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
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const [step, setStep] = useState<Step>("guide");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heightCm, setHeightCm] = useState<string>("");
  const [morphs, setMorphs] = useState<MorphWeights | null>(null);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => stop, [stop]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /// Live skeleton overlay — draws in the video's pixel space; the canvas is
  /// mirrored with the same -scale-x-100 as the video so they line up.
  const overlayLoop = useCallback(() => {
    let last = 0;
    const tick = async (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (t - last < 120 || busyRef.current) return; // ~8fps is plenty
      last = t;
      const v = videoRef.current;
      const c = overlayRef.current;
      if (!v || !c || v.videoWidth === 0) return;
      if (c.width !== v.videoWidth) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      let pose = null;
      try {
        pose = await detectPose(v);
      } catch {
        return; // model still loading — keep the loop alive
      }
      ctx.clearRect(0, 0, c.width, c.height);
      setReady(pose?.ready ?? false);
      if (!pose) return;
      const col = pose.ready ? "#34d399" : "#fbbf24";
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = Math.max(2, c.width / 240);
      for (const [a, b] of POSE_BONES) {
        const pa = pose.points[a];
        const pb = pose.points[b];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * c.width, pa.y * c.height);
        ctx.lineTo(pb.x * c.width, pb.y * c.height);
        ctx.stroke();
      }
      for (const p of pose.points) {
        ctx.beginPath();
        ctx.arc(p.x * c.width, p.y * c.height, ctx.lineWidth * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [videoRef]);

  const begin = async () => {
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/avatar/consent", { method: "POST" }).catch(() => undefined);
      setStep("camera");
      const ok = await start();
      if (!ok) {
        setErr("ကင်မရာခွင့် မရပါ — settings မှာ ခွင့်ပြုပေးပါ");
        return;
      }
      overlayLoop();
    } finally {
      setBusy(false);
    }
  };

  const measureNow = async () => {
    const v = videoRef.current;
    if (!v || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const m = await captureBody(v);
      if ("error" in m) {
        setErr(m.error);
        return;
      }
      const h = Number(heightCm);
      const weights = sanitizeMorphs(
        measurementsToMorphs(m, Number.isFinite(h) && h > 0 ? h : null),
      );
      setMorphs(weights);
      cancelAnimationFrame(rafRef.current);
      stop();
      setStep("result");
    } catch (e) {
      setErr(
        e instanceof Error && e.message
          ? e.message
          : "Scan engine ဆွဲလို့မရပါ — network စစ်ပြီး ပြန်ကြိုးစားပါ",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /// ⏱ Self-timer: prop the phone up, step back, get counted in.
  const timerCapture = () => {
    if (busy || countdown !== null) return;
    setErr(null);
    let n = 5;
    setCountdown(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(iv);
        setCountdown(null);
        void measureNow();
      } else {
        setCountdown(n);
      }
    }, 1000);
  };

  const retake = () => {
    setMorphs(null);
    setStep("camera");
    void start().then((ok) => {
      if (ok) overlayLoop();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#0d1220] p-4 text-white">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">🧍 ကိုယ်ခန္ဓာ Scan</h2>
          <button
            onClick={() => {
              cancelAnimationFrame(rafRef.current);
              stop();
              onClose();
            }}
            className="rounded-full px-2 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        {step === "guide" && (
          <div className="space-y-3 text-[13px] leading-relaxed text-white/80">
            <ul className="list-disc space-y-1 pl-5 text-white/65">
              <li>ကင်မရာကနေ ၂-၃ မီတာ ခွာပြီး တစ်ကိုယ်လုံး ပေါ်အောင် ရပ်ပါ</li>
              <li>လက်နှစ်ဖက် ခန္ဓာကိုယ်ကနေ နည်းနည်း ဖြာထား (A-pose)</li>
              <li>ကိုယ်ကပ်အဝတ် ဝတ်ထားရင် ပိုတိကျတယ်</li>
              <li>
                တစ်ယောက်တည်းဆို ဖုန်းကို ထောင်ထားပြီး <b>⏱ 5s</b> ခလုတ် သုံးပါ
              </li>
            </ul>
            <label className="block text-xs text-white/60">
              အရပ် (cm) — ထည့်ရင် တိကျမှု သိသိသာသာ တက်တယ်
              <input
                type="number"
                inputMode="numeric"
                min={120}
                max={220}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="ဥပမာ 168"
                className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </label>
            <button
              onClick={begin}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              {busy ? "…" : "ကင်မရာ ဖွင့်မယ်"}
            </button>
          </div>
        )}

        {step === "camera" && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                className={`aspect-[3/4] w-full object-cover${mirror}`}
              />
              {/* Live skeleton — same mirror as the video so bones sit on the body */}
              <canvas
                ref={overlayRef}
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover${mirror}`}
              />
              {/* Camera controls: 🔁 front/back, 🔦 torch (back cam, if the
                  device supports it) — someone else scanning you with the
                  back camera gives a far better capture */}
              <div className="absolute right-2 top-2 flex flex-col gap-2">
                <button
                  onClick={() => void flip()}
                  disabled={countdown !== null || busy}
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
              {/* A-pose stick-figure guide */}
              <svg
                viewBox="0 0 100 150"
                className="pointer-events-none absolute inset-x-0 top-[4%] mx-auto h-[92%] opacity-35"
              >
                <g
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                >
                  <circle cx="50" cy="16" r="10" />
                  <line x1="50" y1="26" x2="50" y2="76" />
                  <line x1="50" y1="38" x2="22" y2="70" />
                  <line x1="50" y1="38" x2="78" y2="70" />
                  <line x1="50" y1="76" x2="34" y2="138" />
                  <line x1="50" y1="76" x2="66" y2="138" />
                </g>
              </svg>
              {/* Big self-timer countdown */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-7xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                    {countdown}
                  </span>
                </div>
              )}
              {/* Tracking status */}
              <div
                className={`absolute inset-x-0 top-2 mx-auto w-fit rounded-full px-3 py-1 text-[11px] font-semibold ${
                  ready
                    ? "bg-emerald-500/85 text-black"
                    : "bg-amber-500/85 text-black"
                }`}
              >
                {camState !== "on"
                  ? camState === "starting"
                    ? "ကင်မရာ ဖွင့်နေသည်…"
                    : "ကင်မရာ မရသေးပါ"
                  : ready
                    ? "✓ တစ်ကိုယ်လုံး မြင်ရပြီ"
                    : "လက်ခြေ အကုန်ပေါ်အောင် ရပ်ပါ"}
              </div>
            </div>
            {/* ⏺ Pro-scanner record ခလုတ် (5s timer) + 📸 ချက်ချင်း fallback */}
            <div className="flex items-center justify-center gap-6">
              <RecordButton
                onClick={timerCapture}
                disabled={busy || camState !== "on" || countdown !== null}
                label={
                  countdown !== null
                    ? `⏱ ${countdown}…`
                    : busy
                      ? "တိုင်းနေသည်…"
                      : "⏱ 5s ပြီး တိုင်းမယ်"
                }
              />
              <button
                onClick={measureNow}
                disabled={busy || camState !== "on" || countdown !== null}
                className="rounded-full border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-40"
              >
                📸 ချက်ချင်း
              </button>
            </div>
          </div>
        )}

        {step === "result" && morphs && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-300">
              ✓ တိုင်းတာမှု ရပါပြီ — 3D ခန္ဓာကိုယ်မှာ ချက်ချင်း သက်ရောက်ပြီး
            </p>
            {/* Live mesh with the measured morphs applied */}
            <div className="h-64 overflow-hidden rounded-xl border border-white/10">
              <AvatarPreview
                config={{ ...DEFAULT_SCAN_AVATAR, morphs }}
                bodyGlbUrl={null}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
              {Object.entries(morphs).map(([k, v]) => {
                const w = v ?? 0;
                return (
                  <div key={k} className="text-[12px] text-white/75">
                    <div className="mb-0.5 flex justify-between">
                      <span>{MORPH_LABELS[k as MorphKey] ?? k}</span>
                      <span className="tabular-nums text-white/50">
                        {w > 0 ? "+" : ""}
                        {Math.round(w * 100)}
                      </span>
                    </div>
                    {/* centered bar: 0 in the middle, −100…+100 */}
                    <div className="relative h-1.5 rounded-full bg-white/10">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
                      <div
                        className="absolute top-0 h-full rounded-full bg-emerald-400"
                        style={{
                          left: w < 0 ? `${50 + w * 50}%` : "50%",
                          width: `${Math.abs(w) * 50}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-white/45">
              Scan က အစမှတ်ပဲ — Body tab ရဲ့ slider တွေနဲ့ ဆက်ချိန်လို့ရတယ်
            </p>
            <div className="flex gap-2">
              <button
                onClick={retake}
                className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/80"
              >
                ပြန်တိုင်းမယ်
              </button>
              <button
                onClick={() => onApply(morphs)}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                ✓ သုံးမယ်
              </button>
            </div>
          </div>
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
