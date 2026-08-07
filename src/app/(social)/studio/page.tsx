import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/auth";
import { StudioShell } from "@/features/studio/StudioShell";

/// 🎛 gWave 3D Studio — **တစ်ခုတည်းသော 3D system** (user: "/engine,
/// /scan, /profile/avatar အားလုံးကို function တစ်ခုတည်းဖြစ်အောင် ပေါင်း")။
///
/// အရင်က သီးခြား ၃ ခု — Avatar editor (/profile/avatar), 3D Scanner
/// (/scan), Game Engine (/engine/index.html) — ဘယ်ဟာက ဘယ်ဟာနဲ့ ဆက်စပ်လဲ
/// မသိရဘဲ ကွဲနေတယ်။ အခု workspace တစ်ခုတည်း အောက်မှာ tab ၃ ခုအဖြစ်
/// စုထားတယ်: 🧬 Avatar · 🛰 Scanner · 🏃 Movement · 🧱 World Builder။
///
/// ★ Login မလိုတဲ့ Scanner ကို guest လည်း သုံးလို့ရအောင် page ကို
///   ပိတ်မထားဘူး — Avatar tab ကသာ login တောင်းတယ် (shell ထဲမှာ)။
/// ★ ဟောင်းတဲ့ route ၃ ခုက ဒီကို 308 redirect — bookmark/app link/
///   metaverse ထဲက link တွေ အကုန် ဆက်အလုပ်လုပ်တယ်။

export const metadata: Metadata = {
  title: "gWave 3D Studio — Avatar · Scanner · World",
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const profile = await getCurrentProfile();
  return (
    <StudioShell
      initialTab={
        tab === "scan" || tab === "world" || tab === "move" ? tab : "avatar"
      }
      signedIn={Boolean(profile)}
    />
  );
}
