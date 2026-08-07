import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { refreshCognitoTokens } from "@/lib/auth/cognito";

export const dynamic = "force-dynamic";

/// 🏠 GET /api/world/room — ဝင်ရောက်ထားသူရဲ့ **ကိုယ်ပိုင် virtual room key**。
///
/// Open World server (deploy/world-server) မှာ ကမ္ဘာတစ်ခုရဲ့ ပိုင်ရှင်ကို
/// `playerKey(pl) = pl.sub` — Cognito ရဲ့ `sub` နဲ့ မှတ်တယ်။ ဒါကြောင့်
/// "ကိုယ့်အခန်းကို လာလည်ပါ" link ဆောက်ဖို့ အဲဒီ sub ကို လိုတယ်။
///
/// ★ ကိုယ့်ဟာကိုယ်ပဲ ရတယ် — parameter မခံဘူး၊ session ကနေပဲ ထုတ်တယ်။
///   တခြားလူရဲ့ sub ကို ဒီကနေ ဘယ်တော့မှ မထုတ်ပေးဘူး (တခြားသူရဲ့ အခန်းကို
///   သူတို့ မျှဝေတဲ့ link ကနေပဲ ရောက်ရမယ်)。
export async function GET() {
  const store = await cookies();
  const rt = store.get("gw_rt")?.value;
  const cu = store.get("gw_cu")?.value;
  if (!rt || !cu) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const identity = await refreshCognitoTokens(rt, cu);
  if (!identity?.idToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  // idToken ရဲ့ payload ကနေ `sub` ကို ဖတ်တယ်။ Token ကို ကိုယ်တိုင်
  // Cognito ဆီက ခုမှ ယူထားတာမို့ ဒီမှာ signature ထပ်စစ်စရာ မလိုဘူး —
  // ဒါက ကိုယ့်ဆီ ပြန်ပြဖို့ ကိုယ့်ဒေတာပဲ။
  let sub: string | null = null;
  try {
    const part = identity.idToken.split(".")[1];
    if (part) {
      const json = Buffer.from(
        part.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8");
      const claims = JSON.parse(json) as { sub?: unknown };
      if (typeof claims.sub === "string" && claims.sub) sub = claims.sub;
    }
  } catch {
    sub = null;
  }
  if (!sub) {
    return NextResponse.json({ error: "no-room" }, { status: 404 });
  }
  return NextResponse.json(
    { key: sub },
    { headers: { "cache-control": "no-store, private" } },
  );
}
