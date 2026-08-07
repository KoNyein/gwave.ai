import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { HOME_COOKIE, homeHrefFor } from "@/lib/home-choice";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/welcome"); // ဧည့်သည် — marketing page

  // 🚪 ဝင်ရာ နေရာ — user ကိုယ်တိုင် ရွေးထားတာ ရှိရင် အဲဒီကို တိုက်ရိုက်။
  //
  // အရင်က signed-in သူတိုင်းကို /metaverse ကို အတင်း ပို့တယ် (metaverse-
  // first)。 ဒါပေမယ့် ဈေးရောင်းဖို့/POS ဖွင့်ဖို့ ဝင်တဲ့သူက 3D လောကတစ်ခု
  // ဖြတ်ရတယ် — အဲဒါက အနှောင့်အယှက်ပဲ (user: "ဝင်ဝင်ချင်း category တွေ
  // ရွေးဝင်လို့ရအောင်")。 မရွေးရသေးရင် တံခါးဝ (/start) ကို ပြတယ်။
  const key = (await cookies()).get(HOME_COOKIE)?.value;
  redirect(homeHrefFor(key) ?? "/start");
}
