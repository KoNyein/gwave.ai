import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";

import { StartPicker } from "./start-picker";

export const dynamic = "force-dynamic";

/// 🚪 ဝင်ရာ တံခါး — login ပြီးရင် category ရွေးတဲ့ စာမျက်နှာ။
/// `/` က ရွေးချယ်မှု မမှတ်ထားရင် ဒီကို ပို့တယ်။
export default async function StartPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/welcome");
  return (
    <StartPicker
      name={profile.full_name ?? profile.username ?? ""}
    />
  );
}
