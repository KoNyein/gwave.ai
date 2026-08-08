import { WelcomeHub } from "@/components/home/welcome-hub";
import { redirect } from "next/navigation";

import { getCurrentProfile, isAdultProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 🚪 gwave.cc ရဲ့ ပင်မ စာမျက်နှာ = **ကြိုဆိုစာမျက်နှာ**。
 *
 * user: "/start ကို main welcome page အဖြစ်ထားပေးပါ —
 *        သွားချင်တဲ့နေရာကို သွားနိုင်သော menu များ စနစ်တကျ ရှိရမည်"
 *
 * ခရီးစဉ် သုံးမျိုး ဖြတ်သန်းခဲ့တယ်:
 *   ① signed-in တိုင်း `/metaverse` ကို အတင်း — ဈေးရောင်းသူက 3D လောက
 *      ဖြတ်ရတယ်
 *   ② `gw_home` cookie ရှိရင် အဲဒီကို အတင်း — မှတ်ပြီးရင် ကြိုဆိုစာမျက်နှာ
 *      ဘယ်တော့မှ ပြန်မမြင်ရတော့ဘူး
 *   ③ **အခု** — ဖွင့်တိုင်း ဒီကို ရောက်ပြီး ကိုယ်တိုင် ရွေးတယ်
 *
 * ★ `gw_home` cookie ကို **ဖတ်တာ ရပ်လိုက်ပြီ** — အလိုအလျောက် ပို့တာက
 *   "ကြိုဆိုစာမျက်နှာ" ဆိုတဲ့ သဘောတရားနဲ့ တိုက်ရိုက် ဆန့်ကျင်တယ်။
 *   (cookie ကိုယ်တိုင်က ဆက်ရှိတယ် — Flutter app ရဲ့ ဝင်ရာနေရာ
 *    ရွေးချယ်မှုက အဲဒီ key ကို ဆက်သုံးတယ်။)
 */
export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/welcome"); // ဧည့်သည် — marketing page
  return (
    <WelcomeHub
      name={profile.full_name ?? profile.username ?? ""}
      isAdult={isAdultProfile(profile)}
    />
  );
}
