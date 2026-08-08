import { redirect } from "next/navigation";

import { WelcomeHub } from "@/components/home/welcome-hub";
import { getCurrentProfile, isAdultProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gwave — ဘယ်ကို သွားမလဲ?" };

/// 🚪 ပင်မ ကြိုဆိုစာမျက်နှာ။ `/` ကလည်း ဒီ component ကိုပဲ ပြတယ် —
/// စာမျက်နှာ နှစ်ခု မထားဘူး၊ တစ်ခုတည်းကို လမ်းကြောင်း နှစ်ခုက ညွှန်တယ်။
export default async function StartPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/welcome");
  return (
    <WelcomeHub
      name={profile.full_name ?? profile.username ?? ""}
      isAdult={isAdultProfile(profile)}
    />
  );
}
