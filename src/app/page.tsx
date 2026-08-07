import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // 🌍 Metaverse-first (user: "login ဝင်လိုက်တာနဲ့ Metaverse room ထဲ ရောက်ပါ")
  // — ဝင်ပြီးသားသူတွေက လောကထဲ တန်းရောက်တယ်၊ feed က လောကထဲက 🫂 Social
  // panel ရော ☰ menu ရော ကနေ ရနေသေးတယ်။ ဧည့်သည်က marketing page။
  const profile = await getCurrentProfile();
  redirect(profile ? "/metaverse" : "/welcome");
}
