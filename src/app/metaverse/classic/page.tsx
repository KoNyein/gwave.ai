"use client";

import dynamic from "next/dynamic";

/// three.js က `window` ကို import ချိန်မှာကိုပဲ ထိတယ် — server မှာ render
/// လုပ်လို့မရဘူး။ `ssr: false` က client component ထဲမှာသာ ခွင့်ပြုလို့ ဒီ page
/// ကိုယ်တိုင် client ဖြစ်ရတယ်။
const MetaverseScene = dynamic(
  () =>
    import("@/components/metaverse/metaverse-scene").then(
      (m) => m.MetaverseScene,
    ),
  {
    ssr: false,
    loading: () => <SceneLoading />,
  },
);

function SceneLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0e24]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
        <p className="text-sm text-white/60">လောကကို ဖွင့်နေသည်…</p>
      </div>
    </div>
  );
}

export default function MetaversePage() {
  return <MetaverseScene />;
}
