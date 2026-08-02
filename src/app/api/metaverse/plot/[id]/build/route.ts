import { NextRequest, NextResponse } from "next/server";
import { keccak256, toHex } from "viem";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { LIMITS, plotCenter, validateBuild, type BuildData } from "@/lib/metaverse/build";

export const dynamic = "force-dynamic";

/// ကွက်တစ်ကွက်ရဲ့ ဆောက်လုပ်မှု (Phase 18.5)。
///
/// ★ **အရေးအကြီးဆုံး ၂ ချက်**:
///   1. ပိုင်ဆိုင်မှုကို **server မှာသာ** စစ်တယ် — client မှာ "ဆောက်မယ်"
///      ခလုတ် ဖျောက်ထားရုံနဲ့ ဘာမှ မကာကွယ်ဘူး၊ ဒီ endpoint ကို တိုက်ရိုက်
///      ခေါ်လို့ရတယ်။
///   2. Object တိုင်းက **ကိုယ့်ကွက်ထဲမှာ** ရှိရမယ် — မစစ်ရင် ဘယ်သူမဆို
///      လောကတစ်ခုလုံးပေါ် ဆောက်လို့ရသွားမယ် (`validateBuild`)。
/// ★ On-chain ကို **server က မတင်ပေးဘူး** — gas ကုန်တာက user ရဲ့
///   ဆုံးဖြတ်ချက် ဖြစ်သင့်တယ်။ Hash ကိုပဲ ပြန်ပေးပြီး ကိုယ်တိုင် တင်ချင်ရင်
///   `setBuildHash(plotId, hash)` ကို လက်နဲ့ ခေါ်လို့ရတယ် (spec 18.5)。

type PlotRow = {
  plot_id: number;
  grid_x: number;
  grid_z: number;
  owner_user: string | null;
  owner_wallet: string | null;
  build_data: unknown;
};

function parsePlotId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= 32 * 32) return null;
  return n;
}

/// ★ Hash က **သိမ်းထားတဲ့ JSON အတိအကျ** ကနေ တွက်ရမယ် — client ပို့တဲ့
/// bytes ကနေ တွက်ရင် space တစ်ခု ကွာရုံနဲ့ hash မတူတော့ဘူး၊ အနာဂတ်မှာ
/// ပြန်စစ်လို့ မရတော့ဘူး။
function buildHash(build: BuildData): string {
  return keccak256(toHex(JSON.stringify(build)));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plotId = parsePlotId(id);
  if (plotId === null) {
    return NextResponse.json({ error: "ကွက်နံပါတ် မမှန်ပါ" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("mv_plots")
    .select("plot_id, grid_x, grid_z, owner_user, owner_wallet, build_data")
    .eq("plot_id", plotId)
    .maybeSingle();

  const row = data as PlotRow | null;
  const centre = plotCenter(plotId);
  const profile = await getCurrentProfile();

  return NextResponse.json(
    {
      plotId,
      centerX: centre.x,
      centerZ: centre.z,
      size: LIMITS.plotSize,
      // ★ Owner ရဲ့ id ကို ပြန်မပေးဘူး — "ကိုယ်ပိုင်လား" ဆိုတာပဲ လိုတယ်။
      // ပိုင်ရှင်စာရင်းကို လူတိုင်း ဆွဲယူလို့ရအောင် လုပ်စရာ မလိုဘူး။
      mine: Boolean(profile && row?.owner_user === profile.id),
      claimed: Boolean(row?.owner_user || row?.owner_wallet),
      build: row?.build_data ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plotId = parsePlotId(id);
  if (plotId === null) {
    return NextResponse.json({ error: "ကွက်နံပါတ် မမှန်ပါ" }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON မမှန်ပါ" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── ပိုင်ဆိုင်မှု ────────────────────────────────────────────────────────
  // ★ Flat query — PostgREST embed သုံးရင် schema cache ဟောင်းသွားချိန်မှာ
  // 500 ပြန်ပြီး feature တစ်ခုလုံး တိတ်တိတ် သေသွားမယ် (CLAUDE.md)。
  const { data: plotRow, error: plotErr } = await admin
    .from("mv_plots")
    .select("plot_id, owner_user")
    .eq("plot_id", plotId)
    .maybeSingle();

  if (plotErr) {
    // ★ ဖတ်လို့မရရင် **ငြင်းရမယ်** — "ပိုင်တယ်" လို့ မယူဆရ။
    return NextResponse.json({ error: "ခဏနေ ပြန်ကြိုးစားပါ" }, { status: 503 });
  }
  if (!plotRow || (plotRow as PlotRow).owner_user !== profile.id) {
    return NextResponse.json(
      { error: "ဒီကွက်ဟာ သင့်ဟာ မဟုတ်ပါ" },
      { status: 403 },
    );
  }

  // ── Validation ─────────────────────────────────────────────────────────
  const centre = plotCenter(plotId);
  const result = validateBuild((body as { build?: unknown })?.build, {
    centerX: centre.x,
    centerZ: centre.z,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const build: BuildData = { ...result.build, plotId };
  const { error } = await admin
    .from("mv_plots")
    .update({ build_data: build, synced_at: new Date().toISOString() })
    .eq("plot_id", plotId)
    // ★ Owner ကို ထပ်စစ်တယ် — ဖတ်ချိန်နဲ့ ရေးချိန်ကြားမှာ ကွက်က
    // လက်ပြောင်းသွားနိုင်တယ် (marketplace)。
    .eq("owner_user", profile.id);

  if (error) {
    return NextResponse.json({ error: "သိမ်းလို့ မရပါ" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      objects: build.objects.length,
      // ★ ဒီ hash ကို on-chain တင်ချင်ရင် **ကိုယ်တိုင်** တင်လို့ရတယ် —
      // "ဒီပုံစံက ဒီရက်မှာ ငါ့ဟာ" ဆိုတာ သက်သေပြဖို့။
      hash: buildHash(build),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
