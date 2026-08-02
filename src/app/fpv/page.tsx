"use client";

import dynamic from "next/dynamic";

/// three.js က `window` ကို import ချိန်မှာကိုပဲ ထိတယ် — server render မရ။
const FpvSim = dynamic(
  () => import("@/components/fpv/fpv-sim").then((m) => m.FpvSim),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#0a0e24]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
          <p className="text-sm text-white/60">Simulator ဖွင့်နေသည်…</p>
        </div>
      </div>
    ),
  },
);

export default function FpvPage() {
  return <FpvSim />;
}
