import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// ဒီအကောင့်နဲ့ ချိတ်ထားတဲ့ ပိုင်ဆိုင်မှု ရှိလား (W2)。
///
/// ★ **ဘာလို့ လိုလဲ** — client က `eth_accounts` နဲ့ မေးရင် *browser ထဲက
///   wallet* ကို မေးတာ ဖြစ်တယ်၊ *ဒီအကောင့်နဲ့ ချိတ်ထားတာ* ကို မေးတာ
///   မဟုတ်ဘူး။ Passkey (smart wallet) နဲ့ ချိတ်ထားသူဆိုရင် browser မှာ
///   `window.ethereum` မရှိလို့ ပြန်ဖွင့်တိုင်း "မချိတ်ရသေးပါ" ပြနေမယ်။
///   ဖုန်းပြောင်းသုံးရင်လည်း အတူတူပဲ။ အမှန်တရားက server မှာ ရှိတယ်။
/// ★ ဒါက **ပြသဖို့သာ** — ပိုင်ဆိုင်မှု စစ်ဆေးမှုမှန်သမျှက metaverse
///   server ဘက်မှာသာ ဖြစ်ရမယ်။

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    // ★ ဧည့်သည်အတွက် အမှား မဟုတ်ဘူး — ချိတ်စရာ အကောင့် မရှိသေးတာပဲ။
    return NextResponse.json(
      { wallet: null },
      { headers: { "cache-control": "no-store, private" } },
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("mv_players")
    .select("wallet")
    .eq("user_id", profile.id)
    .maybeSingle();

  return NextResponse.json(
    { wallet: data?.wallet ?? null },
    { headers: { "cache-control": "no-store, private" } },
  );
}
