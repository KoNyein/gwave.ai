import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentProfile, isAdultProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/// Metaverse WebSocket ရဲ့ ဝင်ခွင့်လက်မှတ် (ticket)။
///
/// Browser ရဲ့ WebSocket API က header ထည့်လို့မရဘူး — token ကို URL မှာပဲ
/// ထည့်လို့ရတယ်။ ဒါပေမယ့် URL က ALB access log, CloudWatch, proxy log အကုန်ထဲ
/// ဝင်တတ်လို့ **Cognito access token ကို URL မှာ တိုက်ရိုက်မထည့်ရ** —
/// log ပေါက်တာနဲ့ session တစ်ခုလုံး ပေါက်သွားမယ်။
///
/// အစား သက်တမ်း ၆၀ စက္ကန့်ပဲရှိတဲ့ ticket ကို ဒီမှာ ထုတ်တယ်။ ပေါက်သွားလည်း
/// တစ်မိနစ်အတွင်း သုံးမရတော့ဘူး၊ ပြီးတော့ metaverse ကလွဲပြီး ဘာမှလုပ်လို့မရဘူး
/// (Cognito token နဲ့မတူဘဲ Gwave API တွေကို မဖွင့်ပေးဘူး)။
///
/// ★ Sign in မဝင်ရင် error မဟုတ်ဘူး — ticket မရှိဘဲ guest အဖြစ် ဝင်လို့ရတယ်။
/// Guest က ကိုယ့်နာမည် ကိုယ်ပေးလို့ရပေမယ့် server က `authed: false` လို့
/// အမြဲ တွဲပို့ပြီး client တွေက "ဧည့်သည်" အမှတ်အသားနဲ့ ပြတယ် — အဲဒါက
/// အကောင့်ရှိသူတစ်ယောက်အဖြစ် ဟန်ဆောင်လို့မရအောင် တားတဲ့နည်း။
export async function GET() {
  const secret = process.env.MV_TICKET_SECRET;
  if (!secret) {
    // Ticket မထုတ်နိုင်ဘူး = guest ပဲ ဝင်လို့ရမယ်။ 200 နဲ့ null ပြန်တာက
    // client ကို "စောင့်စရာမလို၊ ဆက်သွား" လို့ ပြောတာ။
    return NextResponse.json({ ticket: null, reason: "not-configured" });
  }

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ticket: null, reason: "guest" });

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: profile.id,
    name: profile.username || profile.full_name || "Gwave",
    // ★ Voice chat ရဲ့ ၁၈+ ဂိတ် (Phase 14)。 WS server က DOB ကို မမြင်ရလို့
    // အသက်စစ်ဆေးမှုကို **ဒီမှာ** (DOB သိတဲ့နေရာ) လုပ်ပြီး ရလဒ်ကိုပဲ
    // ticket ထဲ ထည့်ပေးတယ်။ DOB မထည့်ရသေးသူ = adult မဟုတ် (fail-closed)。
    adult: isAdultProfile(profile),
    iat: now,
    exp: now + 60,
  };

  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");

  return NextResponse.json(
    { ticket: `${body}.${sig}` },
    // ★ ဘယ်တော့မှ cache မလုပ်ရ — CDN တစ်ခုက ticket ကို သိမ်းထားပြီး
    // တခြားသူဆီ ပြန်ပေးရင် အဲဒီသူက ကိုယ့်အကောင့်နဲ့ ဝင်သွားမယ်။
    { headers: { "cache-control": "no-store, private" } },
  );
}
