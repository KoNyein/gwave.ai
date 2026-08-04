"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { useAvatarStore } from "../store/avatarStore";
import {
  MORPH_KEYS,
  MORPH_LABELS,
  SKIN_SWATCHES,
  type AvatarAsset,
} from "../types";
import { AvatarPreview } from "./AvatarPreview";

/// Scanner ကို dynamic — MediaPipe WASM ~12MB က scan နှိပ်မှသာ ဆွဲရမယ်
const FaceScanner = dynamic(
  () => import("../scan/FaceScanner").then((m) => m.FaceScanner),
  { ssr: false },
);

/// 🧬 Avatar editor shell (spec §8) — Phase 1။
/// Tabs: Scan (Phase 2 placeholder + consent + delete) / Body / Skin /
/// ကိုယ်ခန္ဓာပုံစံ (kit variants) / Hair (empty state)။

type Tab = "scan" | "body" | "skin" | "style";

export function AvatarEditor() {
  const { config, dirty, saving, error, load, save, setMorph, patch, resetError } =
    useAvatarStore();
  const [tab, setTab] = useState<Tab>("body");
  const [assets, setAssets] = useState<AvatarAsset[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void load();
    void fetch("/api/avatar/assets?kind=body", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { assets?: AvatarAsset[] } | null) => {
        if (d?.assets) setAssets(d.assets);
      })
      .catch(() => undefined);
  }, [load]);

  // Unsaved-changes guard (spec §8)
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const bodyGlbUrl = useMemo(() => {
    const a = assets.find((x) => x.id === config.outfitId);
    return a?.glbUrl ?? null;
  }, [assets, config.outfitId]);

  const onSave = async () => {
    const ok = await save();
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-3 p-3 md:flex-row">
      {scanning && (
        <FaceScanner
          onClose={() => setScanning(false)}
          onDone={({ faceGlbUrl, faceThumbUrl }) => {
            setScanning(false);
            patch({ faceGlbUrl, faceThumbUrl, scanSource: "face" });
            void save();
          }}
        />
      )}
      {/* ── Preview ── */}
      <div className="relative min-h-[45dvh] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 md:min-h-0">
        <AvatarPreview config={config} bodyGlbUrl={bodyGlbUrl} />
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/60 backdrop-blur">
          ဆွဲလှည့်ကြည့်လို့ရတယ်
        </p>
      </div>

      {/* ── Panel ── */}
      <div className="flex w-full flex-col rounded-2xl border border-white/10 bg-black/30 md:w-96">
        <div className="flex gap-1 border-b border-white/10 p-2">
          {(
            [
              ["scan", "📷 Scan"],
              ["body", "🧍 ကိုယ်ခန္ဓာ"],
              ["skin", "🎨 အသားအရေ"],
              ["style", "👕 ပုံစံ"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                tab === t
                  ? "bg-emerald-500/25 text-emerald-200"
                  : "text-white/60 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {tab === "scan" && (
            <div className="space-y-3 text-sm text-white/75">
              {config.faceGlbUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                  {config.faceThumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={config.faceThumbUrl}
                      alt="scan thumbnail"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 text-[13px]">
                    <p className="text-emerald-200">✓ မျက်နှာ scan တပ်ထားပြီ</p>
                    <button
                      onClick={async () => {
                        await fetch("/api/avatar/upload", { method: "DELETE" }).catch(
                          () => undefined,
                        );
                        patch({ faceGlbUrl: null, faceThumbUrl: null, scanSource: "none" });
                        void save();
                      }}
                      className="mt-1 text-[11px] text-red-300 underline"
                    >
                      🗑 Scan ဖျက်မယ် (အပြီးဖျက်)
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-white/15 bg-white/5 p-3 text-[13px] leading-relaxed">
                  📷 ကင်မရာနဲ့ မျက်နှာကို 3D scan ဖမ်းပြီး avatar ခေါင်းမှာ
                  ကိုယ့်မျက်နှာအစစ် တပ်လို့ရပါပြီ။
                </p>
              )}
              <button
                onClick={() => setScanning(true)}
                className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                📷 {config.faceGlbUrl ? "ပြန် Scan မယ်" : "မျက်နှာ Scan စတင်မယ်"}
              </button>
              <p className="text-[12px] leading-relaxed text-white/50">
                🔒 Biometric — frame တွေ ဖုန်းထဲမှာပဲ process လုပ်တယ်၊
                နောက်ဆုံး 3D file ပဲ upload တက်တယ်၊ ဘယ်အချိန်မဆို ဖျက်လို့ရတယ်။
              </p>
            </div>
          )}

          {tab === "body" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">ခန္ဓာပုံစံ</span>
                {(["m", "f"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => patch({ bodyType: b })}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      config.bodyType === b
                        ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                        : "border-white/15 text-white/60"
                    }`}
                  >
                    {b === "m" ? "👨 ယောက်ျား" : "👩 မိန်းမ"}
                  </button>
                ))}
              </div>
              {MORPH_KEYS.map((k) => (
                <label key={k} className="block">
                  <span className="mb-0.5 flex justify-between text-[11px] text-white/60">
                    <span>{MORPH_LABELS[k]}</span>
                    <span>{Math.round((config.morphs[k] ?? 0) * 100)}</span>
                  </span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.02}
                    value={config.morphs[k] ?? 0}
                    onChange={(e) => setMorph(k, Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </label>
              ))}
              <p className="text-[11px] leading-relaxed text-white/40">
                Phase 1 — အရပ်/ကိုယ်ချိန်/ခေါင်းအရွယ်က preview မှာ
                ချက်ချင်းမြင်ရပြီး ကျန် slider တွေက morph-target base body
                ရောက်တဲ့ Phase မှာ အပြည့် သက်ရောက်ပါမယ်။ Body scan နဲ့
                အလိုအလျောက် ဖြည့်တာ Phase 3 မှာ လာပါမယ်။
              </p>
            </div>
          )}

          {tab === "skin" && (
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-2">
                {SKIN_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => patch({ skinColor: c })}
                    aria-label={`အသားအရေ ${c}`}
                    style={{ backgroundColor: c }}
                    className={`h-9 rounded-lg border-2 ${
                      config.skinColor === c
                        ? "border-emerald-400"
                        : "border-transparent"
                    }`}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-white/60">
                စိတ်ကြိုက်အရောင်
                <input
                  type="color"
                  value={config.skinColor}
                  onChange={(e) => patch({ skinColor: e.target.value })}
                  className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
            </div>
          )}

          {tab === "style" && (
            <div className="space-y-3">
              {assets.length === 0 ? (
                <p className="text-sm text-white/50">
                  ပုံစံစာရင်း ဆွဲနေသည်… (server မှာ avatar_assets migration
                  မသွင်းရသေးရင် ဒီစာရင်းက ဗလာ ဖြစ်နေပါမယ်)
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => patch({ outfitId: a.id })}
                      className={`rounded-xl border p-3 text-left text-sm ${
                        config.outfitId === a.id
                          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      🧍 {a.name}
                      {!a.owned && (
                        <span className="ml-1 text-[10px] text-amber-300">🔒</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-white/40">
                💇 ဆံပင်ပုံစံနဲ့ 👕 ဝတ်စုံ သီးခြားလဲစနစ်က authored asset
                library ရောက်မှ ပွင့်ပါမယ် — အခုက တစ်ကိုယ်လုံး ပုံစံ ရွေးတာပါ။
              </p>
            </div>
          )}
        </div>

        {/* ── Footer: save ── */}
        <div className="border-t border-white/10 p-3">
          {error && (
            <p
              className="mb-2 cursor-pointer rounded bg-red-500/15 px-2 py-1 text-xs text-red-300"
              onClick={resetError}
            >
              ⚠️ {error}
            </p>
          )}
          <button
            onClick={onSave}
            disabled={saving || !dirty}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold ${
              dirty
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : "bg-white/10 text-white/40"
            }`}
          >
            {saving
              ? "သိမ်းနေသည်…"
              : savedFlash
                ? "✓ သိမ်းပြီးပါပြီ"
                : dirty
                  ? "သိမ်းမယ်"
                  : "ပြောင်းလဲမှု မရှိသေးပါ"}
          </button>
        </div>
      </div>
    </div>
  );
}
