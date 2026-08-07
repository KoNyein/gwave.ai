"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/// 🌍 Gwave Metaverse — **လောက တစ်ခုတည်း** (user: "metaverse နဲ့ open world
/// ကို ခုထဲ ဖြစ်အောင်လုပ်ပါ")။
///
/// အရင်က /metaverse (React scene) နဲ့ /world (Open World) ဆိုပြီး လောက
/// နှစ်ခု ခွဲနေတယ် — portal နဲ့ ချိတ်ထားရုံ၊ တစ်ခုတည်း မဟုတ်ဘူး။ အခု
/// **/metaverse ကိုယ်တိုင်က Open World** ဖြစ်သွားပြီ: တံခါးတစ်ပေါက်၊
/// လောကတစ်ခု၊ ရုပ်တစ်မျိုး၊ account တစ်ခု။
///
/// ★ Login token ကို ဒီကနေ ထည့်ပေးတယ် (/api/world/token) — URL ထဲ token
///   ဘယ်တော့မှ မပါဘူး၊ ဂိမ်း iframe ကသာ ရတယ်။
/// ★ ?room= / ?meet= / ?world= စတဲ့ param တွေ ဂိမ်းဆီ ဆက်ပေးတယ် — mobile
///   app ရဲ့ /metaverse?room=city&app=1 link တွေ ဆက်အလုပ်လုပ်တယ်။
/// ★ လောကထဲ မရှိသေးတဲ့ gwave function တွေ (Live, Games, Shop, Studio) က
///   ဂိမ်းထဲက kiosk/radial ကနေ overlay အဖြစ် ပွင့်တယ် — အပြင်မထွက်ရဘူး။
export default function MetaversePage() {
  const router = useRouter();
  const [src, setSrc] = useState<string | null>(null);
  const [note, setNote] = useState("🌍 လောကကို ဖွင့်နေသည်…");

  /// 🧭 လောကထဲက ပွတ်ဆွဲ (လက်နှစ်ချောင်း ညာဘက်) ဒါမှမဟုတ် 📰 tab နှိပ်ရင်
  /// ဂိမ်း iframe က ဒီကို ပြောတယ် — iframe ထဲက touch က parent ဆီ မရောက်လို့
  /// postMessage ကလွဲပြီး တခြားနည်း မရှိဘူး။
  /// ★ origin ကို စစ်တယ် — ကြော်ငြာ iframe တစ်ခုက page ကို လွှဲပစ်လို့ မရ။
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; href?: string } | null;
      if (d?.type !== "gwave:nav" || typeof d.href !== "string") return;
      // ကိုယ့် site ထဲက လမ်းကြောင်းသာ (open redirect မဖြစ်စေရ)
      if (!d.href.startsWith("/") || d.href.startsWith("//")) return;
      router.push(d.href);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  useEffect(() => {
    let alive = true;
    const here = new URLSearchParams(window.location.search);
    void fetch("/api/world/token", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d: { token?: string; name?: string } | null) => {
        if (!alive) return;
        if (!d?.token) setNote("🌍 ဧည့်သည်အဖြစ် ဝင်နေသည်…");
        const q = new URLSearchParams();
        if (d?.token) {
          q.set("token", d.token);
          if (d.name) q.set("name", d.name);
        }
        // ဂိမ်းက နားလည်တဲ့ param တွေ ဆက်ပေး (app=1 က mobile shell အတွက်)
        for (const k of ["room", "meet", "world", "server", "api", "feed", "embed"]) {
          const v = here.get(k);
          if (v) q.set(k, v);
        }
        setSrc(`/world/index.html?${q.toString()}`);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="h-full w-full">
      {src ? (
        <iframe
          src={src}
          title="Gwave Metaverse"
          className="h-full w-full border-0"
          allow="camera; microphone; fullscreen; gamepad; xr-spatial-tracking; accelerometer; gyroscope; autoplay; clipboard-write"
          allowFullScreen
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/70">
          {note}
        </div>
      )}
    </div>
  );
}
