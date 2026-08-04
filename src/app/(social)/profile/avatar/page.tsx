import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { AvatarEditor } from "@/features/avatar/editor/AvatarEditor";

/// 🧬 Avatar editor route (spec §8) — login မဝင်ရင် ပြင်စရာ config မရှိလို့
/// login ကို ပို့တယ်။ Editor ကိုယ်တိုင်က client component (three.js)။

export const metadata: Metadata = {
  title: "Avatar ပြင်ဆင်ရန် — Gwave",
};

export default async function AvatarEditorPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/profile/avatar");

  return (
    <main className="min-h-dvh bg-[#0b0f17] text-white">
      <header className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <a href="/profile" className="text-white/60 hover:text-white">
          ←
        </a>
        <h1 className="text-sm font-semibold">🧬 ကိုယ့် Avatar ပြင်ဆင်ရန်</h1>
      </header>
      <AvatarEditor />
    </main>
  );
}
