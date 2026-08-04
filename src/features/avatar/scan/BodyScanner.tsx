"use client";

import { useEffect, useState } from "react";

import { captureBody, measurementsToMorphs } from "./poseLandmarks";
import { useCamera } from "./useCamera";
import { sanitizeMorphs, type MorphWeights } from "../types";

/// 🧍 Body Scanner modal (spec §5.1) — Phase 3 v1: front A-pose capture။
///
/// Flow: guide (အရပ် cm ထည့်) → camera (silhouette guide) → capture
/// (visibility gate) → morph weights ပြ → apply။
/// ★ Side capture (chest/abdomen depth) က spec ရဲ့ optional ဒုတိယအဆင့် —
///   v1 မှာ front ratio တွေက shoulder/hip/arm/leg/height ကို ဖြည့်တယ်။
/// ★ Consent — face scan နဲ့ တူတူ POST /api/avatar/consent (ရှိပြီးသားရင်
///   ထပ်တောင်းလည်း ပြဿနာမရှိ — idempotent)။

type Step = "guide" | "camera" | "result";

export function BodyScanner({
  onApply,
  onClose,
}: {
  onApply: (morphs: MorphWeights) => void;
  onClose: () => void;
}) {
  const { videoRef, state: camState, start, stop } = useCamera();
  const [step, setStep] = useState<Step>("guide");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heightCm, setHeightCm] = useState<string>("");
  const [morphs, setMorphs] = useState<MorphWeights | null>(null);

  useEffect(() => stop, [stop]);

  const begin = async () => {
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/avatar/consent", { method: "POST" }).catch(() => undefined);
      setStep("camera");
      const ok = await start();
      if (!ok) setErr("ကင်မရာခွင့် မရပါ — settings မှာ ခွင့်ပြုပေးပါ");
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
      stop();
      setStep("result");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d1220] p-4 text-white">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">🧍 ကိုယ်ခန္ဓာ Scan</h2>
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

        {step === "guide" && (
          <div className="space-y-3 text-[13px] leading-relaxed text-white/80">
            <ul className="list-disc space-y-1 pl-5 text-white/65">
              <li>ကင်မရာကနေ ၂-၃ မီတာ ခွာပြီး တစ်ကိုယ်လုံး ပေါ်အောင် ရပ်ပါ</li>
              <li>လက်နှစ်ဖက် ခန္ဓာကိုယ်ကနေ နည်းနည်း ဖြာထား (A-pose)</li>
              <li>ကိုယ်ကပ်အဝတ် ဝတ်ထားရင် ပိုတိကျတယ်</li>
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
                className="aspect-[3/4] w-full -scale-x-100 object-cover"
              />
              {/* Silhouette guide — ခန္ဓာကိုယ် အနေအထား */}
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2">
                <div className="h-[92%] w-[38%] rounded-t-[45%] rounded-b-xl border-2 border-dashed border-emerald-400/60" />
              </div>
              {camState !== "on" && (
                <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/60">
                  {camState === "starting" ? "ကင်မရာ ဖွင့်နေသည်…" : "ကင်မရာ မရသေးပါ"}
                </p>
              )}
            </div>
            <button
              onClick={snap}
              disabled={busy || camState !== "on"}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
            >
              {busy ? "တိုင်းနေသည်…" : "📸 တိုင်းမယ်"}
            </button>
          </div>
        )}

        {step === "result" && morphs && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-300">✓ တိုင်းတာမှု ရပါပြီ</p>
            <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
              {Object.entries(morphs).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span>{Math.round((v ?? 0) * 100)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/45">
              Scan က အစမှတ်ပဲ — Body tab ရဲ့ slider တွေနဲ့ ဆက်ချိန်လို့ရတယ်
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMorphs(null);
                  setStep("camera");
                  void start();
                }}
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
