import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";

export const dynamic = "force-dynamic";

/// ဆောက်လုပ်မှုကို တိုင်ကြားခြင်း + admin ဖျက်ခွင့် (Phase 18.1)。
///
/// ★ User ကို content ဖန်တီးခွင့် ပေးတာနဲ့ **moderation တာဝန်** ပါလာတယ်။
///   Report ခလုတ်၊ admin ဖျက်ခွင့်၊ ၂၄ နာရီ queue — ၃ ခုစလုံး မဖြစ်မနေ။
/// ★ Report က **ဝင်ထားသူသာ** လုပ်လို့ရတယ် — ဧည့်သည်တွေ ခွင့်ပြုရင်
///   ကွက်တစ်ခုကို အလုံးအရင်းနဲ့ တိုင်ပြီး ဖျက်ခိုင်းလို့ရမယ်။

const MAX_REASON = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plotId = Number(id);
  if (!Number.isInteger(plotId) || plotId < 0) {
    return NextResponse.json({ error: "ကွက်နံပါတ် မမှန်ပါ" }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  let body: { reason?: unknown } = {};
  try {
    body = (await request.json()) as { reason?: unknown };
  } catch {
    /* reason မပါလည်း ရတယ် */
  }
  const reason = String(body.reason ?? "").slice(0, MAX_REASON).trim() || null;

  const admin = createAdminClient();

  // ★ တစ်ယောက်တည်းက ကွက်တစ်ခုကို ထပ်ခါထပ်ခါ တိုင်လို့မရ — queue ကို
  // အလုံးအရင်းနဲ့ ဖြည့်ပြီး တကယ့် report တွေကို မြှုပ်ပစ်လို့ရမယ်။
  const { data: existing } = await admin
    .from("mv_build_reports")
    .select("id")
    .eq("plot_id", plotId)
    .eq("reporter", profile.id)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error } = await admin.from("mv_build_reports").insert({
    plot_id: plotId,
    reporter: profile.id,
    reason,
  });

  if (error) {
    return NextResponse.json({ error: "တိုင်ကြားလို့ မရပါ" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/// Admin — တိုင်ကြားခံရတဲ့ ကွက်ရဲ့ ဆောက်လုပ်မှုကို ဖျက်တယ်။
///
/// ★ ကွက်ကို မဖျက်ဘူး၊ **build_data ကိုသာ** ဖျက်တယ် — ကွက်က NFT ဖြစ်လို့
///   ပိုင်ရှင်ဆီက မယူရဘူး၊ မလျော်ကန်တဲ့ ပုံစံကိုပဲ ဖယ်တာ။
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plotId = Number(id);
  if (!Number.isInteger(plotId) || plotId < 0) {
    return NextResponse.json({ error: "ကွက်နံပါတ် မမှန်ပါ" }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "ဝင်ရောက်ပါ" }, { status: 401 });
  }

  // ★ Role ကို **DB ကနေ** ဖတ်တယ် — token ထဲက claim ကို မယုံဘူး
  const db = await createClient();
  const { data: row } = await db
    .from("profiles")
    .select("role")
    .eq("id", profile.id)
    .maybeSingle();
  if (!row || !["moderator", "admin", "super_admin"].includes(row.role)) {
    return NextResponse.json({ error: "ခွင့်ပြုချက် မရှိပါ" }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin
    .from("mv_plots")
    .update({ build_data: null, synced_at: new Date().toISOString() })
    .eq("plot_id", plotId);

  await admin
    .from("mv_build_reports")
    .update({
      status: "removed",
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    })
    .eq("plot_id", plotId)
    .eq("status", "open");

  return NextResponse.json({ ok: true });
}
