import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// SIWE အဆင့် ၃ — ချိတ်ထားတာကို ဖြုတ်တယ် (W2.5)。
///
/// ★ **ဖြုတ်လို့ရမှ ဖြစ်တယ်** — wallet ပျောက်တာ၊ ဖုန်းလဲတာ၊ တခြား
///   wallet တစ်ခုကို သုံးချင်တာ ဒီဘက်မှာ ခဏခဏ ဖြစ်တယ်။ ဖြုတ်လို့မရရင်
///   အဲဒီ အကောင့်က ဘယ်တော့မှ ပိုင်ဆိုင်မှု ပြန်မချိတ်နိုင်တော့ဘူး
///   (တစ် wallet — တစ်အကောင့် စည်းမျဉ်းကြောင့်)。
/// ★ ဖြုတ်တာက **ပစ္စည်းကို မထိဘူး** — ဝယ်ထားတာတွေက `mv_inventory`
///   (RDS) မှာ ရှိတယ်၊ chain က mirror ပဲ။ ဒါက ဒီ စနစ်တစ်ခုလုံးရဲ့
///   အခြေခံဒီဇိုင်း ဆုံးဖြတ်ချက်ပါ။
/// ★ Signature မလိုဘူး — ကိုယ့်အကောင့်ကနေ ကိုယ့်ဟာကို ဖြုတ်တာမို့
///   session ရှိရုံနဲ့ လုံလောက်တယ်။ (ချိတ်တဲ့အခါမှသာ wallet ကို
///   တကယ်ပိုင်လားဆိုတာ သက်သေပြရမယ်။)

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "Gwave အကောင့်နဲ့ အရင်ဝင်ပါ" },
      { status: 401, headers: { "cache-control": "no-store, private" } },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("mv_players")
    .update({ wallet: null })
    .eq("user_id", profile.id);

  if (error) {
    return NextResponse.json(
      { error: "ဖြုတ်၍ မရပါ — ပြန်ကြိုးစားပါ" },
      { status: 500, headers: { "cache-control": "no-store, private" } },
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store, private" } },
  );
}
