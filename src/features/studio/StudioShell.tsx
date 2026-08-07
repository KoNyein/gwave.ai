"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ScanHub } from "@/features/scan3d/ScanHub";

/// 🎛 Studio shell — 3D function ၃ ခုလုံးကို tab တစ်ခုတည်းအောက်မှာ။
///
/// ★ Tab တစ်ခုစီက အလေးချိန်ကြီးတဲ့ 3D bundle မို့ **ရွေးမှသာ mount**
///   လုပ်တယ် (dynamic import + conditional render) — page ဖွင့်ရုံနဲ့
///   three.js ၃ ခုစလုံး ဆွဲမချဘူး။
/// ★ Tab ပြောင်းရင် URL ?tab= လည်း ပြောင်းတယ် (replaceState) — link
///   မျှလို့ရ၊ back button မပျက်။
/// ★ World Builder က static app (public/engine) — iframe နဲ့ တင်ထားတယ်
///   (CSP frame-src 'self')။ Studio/World Maker/XR/Generator variant
///   တွေကို ဒီ tab ထဲကပဲ ခလုတ်နဲ့ ကူးလို့ရ။

const AvatarEditor = dynamic(
  () => import("@/features/avatar/editor/AvatarEditor").then((m) => m.AvatarEditor),
  { ssr: false, loading: () => <Loading label="🧬 Avatar studio ဖွင့်နေသည်…" /> },
);

type Tab = "avatar" | "scan" | "world";

const TABS: { id: Tab; icon: string; label: string; hint: string }[] = [
  { id: "avatar", icon: "🧬", label: "Avatar", hint: "မျက်နှာ/ကိုယ်ခန္ဓာ scan → ကိုယ်ပိုင်ရုပ်" },
  { id: "scan", icon: "🛰", label: "Scanner", hint: "အခန်း · ပစ္စည်း 3D scan" },
  { id: "world", icon: "🧱", label: "World", hint: "ကမ္ဘာ/ဂိမ်း တည်ဆောက်ရန်" },
];

/// World Builder ရဲ့ variant များ — အားလုံး public/engine က static app
const WORLD_APPS: { file: string; icon: string; label: string }[] = [
  { file: "index.html", icon: "🧱", label: "Engine" },
  { file: "studio.html", icon: "🎬", label: "Studio" },
  { file: "world-maker.html", icon: "🗺", label: "World Maker" },
  { file: "generator.html", icon: "✨", label: "Generator" },
  { file: "xr.html", icon: "🥽", label: "XR" },
];

function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-white/60">
      {label}
    </div>
  );
}

export function StudioShell({
  initialTab,
  signedIn,
}: {
  initialTab: Tab;
  signedIn: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [worldApp, setWorldApp] = useState("index.html");

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }, [tab]);

  return (
    <div className="flex h-dvh flex-col bg-[#0b0f17] text-white">
      {/* ── One header for all three tools ── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <Link href="/menu" className="px-1 text-white/60 hover:text-white">
          ←
        </Link>
        <h1 className="mr-1 shrink-0 text-sm font-semibold">🎛 gWave 3D Studio</h1>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.hint}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                tab === t.id
                  ? "bg-emerald-500/25 text-emerald-200"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        {tab === "world" && (
          <select
            value={worldApp}
            onChange={(e) => setWorldApp(e.target.value)}
            className="hidden shrink-0 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-[12px] text-white/80 sm:block"
          >
            {WORLD_APPS.map((a) => (
              <option key={a.file} value={a.file}>
                {a.icon} {a.label}
              </option>
            ))}
          </select>
        )}
      </header>

      {/* ── Tool surface — ရွေးထားတဲ့ tab တစ်ခုသာ mount ── */}
      <div className="min-h-0 flex-1">
        {tab === "avatar" &&
          (signedIn ? (
            <AvatarEditor />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-white/75">
                🧬 ကိုယ်ပိုင် avatar သိမ်းဖို့ Gwave account လိုပါတယ်
              </p>
              <Link
                href="/login?next=/studio%3Ftab%3Davatar"
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                ဝင်မယ်
              </Link>
              <button
                onClick={() => setTab("scan")}
                className="text-[13px] text-white/50 underline"
              >
                🛰 Scanner ကတော့ login မလိုပါ — အဲဒါ သုံးမယ်
              </button>
            </div>
          ))}

        {tab === "scan" && (
          <div className="h-full overflow-y-auto">
            <ScanHub />
          </div>
        )}

        {tab === "world" && (
          <iframe
            key={worldApp}
            src={`/engine/${worldApp}`}
            title="gWave World Builder"
            className="h-full w-full border-0"
            allow="fullscreen; xr-spatial-tracking; camera; gyroscope; accelerometer"
          />
        )}
      </div>
    </div>
  );
}
