import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { GRID_COLS, LIMITS } from "@/lib/metaverse/build";

export const dynamic = "force-dynamic";

/// အနီးအနားက ကွက်များ — plot streaming (Phase 18.6)。
///
/// ★ ကွက် ၁,၀၂၄ ခုလုံးကို တစ်ပြိုင်နက် မဆွဲရ — build data တွေက ကွက်တစ်ခုကို
///   ၂၀၀ object အထိ ရှိလို့ payload က မဂါဘိုက်ချီ ဖြစ်သွားမယ်။ Player ရဲ့
///   ၄၀ unit အတွင်းက ကွက်တွေကိုသာ ပေးတယ်။
/// ★ ဒါက **အများပြည်သူ** data — ဆောက်ထားတာက လောကထဲမှာ မြင်ရမယ့်အရာ။
///   ဒါပေမယ့် ပိုင်ရှင်ရဲ့ id ကို မပါစေဘူး (`mine` boolean သာ)。

const MAX_RADIUS = 3; // ကွက် ၇×၇ = ၄၉ ခု အများဆုံး

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const x = Number(q.get("x"));
  const z = Number(q.get("z"));
  if (![x, z].every(Number.isFinite)) {
    return NextResponse.json({ error: "x/z မမှန်ပါ" }, { status: 400 });
  }

  // ကမ္ဘာ့ coordinate → grid
  const gx = Math.floor(x / LIMITS.plotSize) + GRID_COLS / 2;
  const gz = Math.floor(z / LIMITS.plotSize) + GRID_COLS / 2;
  const r = Math.min(MAX_RADIUS, Math.max(1, Number(q.get("r")) || 2));

  const admin = createAdminClient();
  const profile = await getCurrentProfile();

  const { data } = await admin
    .from("mv_plots")
    .select("plot_id, grid_x, grid_z, owner_user, build_data")
    .gte("grid_x", gx - r)
    .lte("grid_x", gx + r)
    .gte("grid_z", gz - r)
    .lte("grid_z", gz + r);

  type Row = {
    plot_id: number;
    grid_x: number;
    grid_z: number;
    owner_user: string | null;
    build_data: unknown;
  };

  const plots = ((data ?? []) as Row[])
    // ဗလာကွက်တွေကို မပို့ဘူး — ဆွဲစရာ ဘာမှ မရှိဘူး
    .filter((p) => p.build_data)
    .map((p) => ({
      plotId: p.plot_id,
      mine: Boolean(profile && p.owner_user === profile.id),
      build: p.build_data,
    }));

  return NextResponse.json(
    { plots },
    // ★ ၁၅ စက္ကန့် — ဆောက်ပြီးတာနဲ့ ချက်ချင်း မမြင်ရလည်း ရတယ်၊ ဒါပေမယ့်
    // ရွှေ့တိုင်း DB ကို မထိသင့်ဘူး။
    { headers: { "cache-control": "public, max-age=0, s-maxage=15" } },
  );
}
