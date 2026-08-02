import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { SIWE_DOMAIN, siweChainId } from "@/lib/metaverse/siwe";

export const dynamic = "force-dynamic";

/// SIWE အဆင့် ၁ — nonce ထုတ်တယ်။
///
/// ★ **တစ်ခါသုံး** ဖြစ်ရမယ်။ ဒါမရှိရင် တစ်ခါ sign လုပ်ထားတဲ့ signature ကို
///   ဖမ်းယူပြီး ထပ်ပို့ရုံနဲ့ တခြားသူရဲ့ wallet အဖြစ် ဟန်ဆောင်လို့ရသွားမယ်
///   (replay attack)။ ဒါကြောင့် DB မှာ သိမ်းပြီး သုံးပြီးရင် `used_at`
///   မှတ်တယ် — memory ထဲမှာ ထားရင် server ပြန်စတိုင်း ပျောက်ပြီး၊ task
///   ၂ လုံးဆိုရင် တစ်လုံးက ထုတ်တာကို ကျန်တစ်လုံးက မသိဘူး။
/// ★ **Sign in ဝင်ထားမှသာ** — wallet က Gwave အကောင့်တစ်ခုနဲ့ ချိတ်တာမို့
///   ဘယ်အကောင့်လဲ ဆိုတာ အရင်သိရမယ်။ ဧည့်သည်မှာ ချိတ်စရာ အကောင့်မရှိဘူး။

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "wallet ချိတ်ဖို့ Gwave အကောင့်နဲ့ အရင်ဝင်ပါ" },
      { status: 401, headers: { "cache-control": "no-store, private" } },
    );
  }

  const nonce = crypto.randomBytes(24).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin
    .from("mv_wallet_nonces")
    .insert({ nonce, user_id: profile.id });

  if (error) {
    return NextResponse.json({ error: "nonce မထုတ်နိုင်ပါ" }, { status: 500 });
  }

  return NextResponse.json(
    // ★ `chainId` ကို server က ပြောပေးတယ် — client က ကိုယ့်ဘာသာ
    // ရွေးလို့ရရင် စာထဲက chain နဲ့ server စစ်တဲ့ chain မတူဘဲ ဖြစ်နိုင်တယ်။
    { nonce, issuedAt: new Date().toISOString(), chainId: siweChainId(), domain: SIWE_DOMAIN },
    // ★ ဘယ်တော့မှ cache မလုပ်ရ — CDN တစ်ခုက nonce ကို သိမ်းပြီး
    // တခြားသူဆီ ပြန်ပေးရင် တစ်ခါသုံးဆိုတာ အဓိပ္ပာယ်မရှိတော့ဘူး။
    { headers: { "cache-control": "no-store, private" } },
  );
}
