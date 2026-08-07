"use client";

import { useEffect, useState } from "react";

/// 🌏 Open World launcher — public/world (gwave-metaverse-base v5) ကို
/// gwave login နဲ့ ချိတ်ပြီး ဖွင့်ပေးတယ်။
///
/// Login ရှိရင် /api/world/token က Cognito idToken ထုတ်ပြီး ?token= နဲ့
/// ပို့တယ် — game server (AUTH_MODE=cognito) က JWKS နဲ့ စစ်ပြီး နာမည်က
/// gwave account နာမည်အတိုင်း ဖြစ်တယ်။ Login မရှိ (guest) ရင် token မပါဘဲ
/// ဖွင့်တယ် — offline single-player အဖြစ် ကစားလို့ရတယ် (NetClient က
/// server ငြင်းရင် offline mode ကို သူ့ဘာသာ ဆင်းတယ်)။
export default function WorldLauncher() {
  const [note, setNote] = useState("🌏 Open World ဖွင့်နေသည်…");

  useEffect(() => {
    let alive = true;
    void fetch("/api/world/token", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d: { token?: string; name?: string } | null) => {
        if (!alive) return;
        if (!d?.token) setNote("🌏 Guest အဖြစ် ဝင်နေသည်…");
        const q = d?.token
          ? `?token=${encodeURIComponent(d.token)}&name=${encodeURIComponent(d.name ?? "")}`
          : "";
        window.location.replace(`/world/index.html${q}`);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#070b18] text-white/80">
      <p className="text-sm">{note}</p>
    </div>
  );
}
