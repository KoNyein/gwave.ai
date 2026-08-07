import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { refreshCognitoTokens } from "@/lib/auth/cognito";

export const dynamic = "force-dynamic";

/// 🌏 GET /api/world/token — Open World (public/world) multiplayer join token။
///
/// Game server (deploy/world-server) က **raw Cognito JWT** ကို JWKS နဲ့
/// စစ်တယ်၊ ဒါပေမယ့် web session မှာ ကိုယ်ပိုင် mint လုပ်ထားတဲ့ gw_at နဲ့
/// Cognito refresh token (gw_rt) ပဲ ရှိတယ်။ ဒါကြောင့် refresh token ကို
/// idToken အသစ်နဲ့ လဲပြီး client ကို ပေးတယ် — token သက်တမ်း ၁ နာရီ၊
/// game session တစ်ခါ join ဖို့ လုံလောက်တယ်။
export async function GET() {
  const store = await cookies();
  // gw_rt / gw_cu — httpOnly session cookies (src/lib/auth/session.ts)
  const rt = store.get("gw_rt")?.value;
  const cu = store.get("gw_cu")?.value;
  if (!rt || !cu) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const [identity, profile] = await Promise.all([
    refreshCognitoTokens(rt, cu),
    getCurrentProfile(),
  ]);
  if (!identity?.idToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json(
    {
      token: identity.idToken,
      name: profile?.full_name || profile?.username || cu,
    },
    { headers: { "cache-control": "no-store, private" } },
  );
}
