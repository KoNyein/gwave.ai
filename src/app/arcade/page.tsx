"use client";

import dynamic from "next/dynamic";

/// three.js က window ကို ထိလို့ client-only
const EduArcade = dynamic(
  () => import("@/components/arcade/arcade").then((m) => m.EduArcade),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#101a33]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
          <p className="text-sm text-white/60">Arcade ဖွင့်နေသည်…</p>
        </div>
      </div>
    ),
  },
);

export default function ArcadePage() {
  return <EduArcade />;
}
