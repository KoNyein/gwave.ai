import type { Metadata } from "next";

import { ScanHub } from "@/features/scan3d/ScanHub";

/// 🛰 3D Scanner hub route — Room / Object / Avatar scan modes။
/// Login မလို — scan တွေက စက်ထဲ (IndexedDB) မှာပဲ သိမ်းတယ်; avatar scan
/// ကတော့ သူ့ editor route က login စစ်ပြီးသား။

export const metadata: Metadata = {
  title: "3D Scanner — Gwave",
};

export default function ScanPage() {
  return (
    <main className="min-h-dvh bg-[#0b0f17] text-white">
      <header className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <a href="/menu" className="text-white/60 hover:text-white">
          ←
        </a>
        <h1 className="text-sm font-semibold">🛰 3D Scanner</h1>
      </header>
      <ScanHub />
    </main>
  );
}
