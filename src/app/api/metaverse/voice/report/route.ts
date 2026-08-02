import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// Voice chat report (Phase 14.4 — မဖြစ်မနေ)。
///
/// ★ Voice ကို record မလုပ်ဘူး (P2P) — ဒါကြောင့် report က "ဘယ်သူ၊
///   ဘယ်အချိန်၊ ဘယ် room" metadata ကိုပဲ ပို့တယ်။ ရှိပြီးသား `reports`
///   table (admin/moderation queue) ထဲ ဝင်တယ်။
/// ★ Voice က ၁၈+ signed-in only ဖြစ်လို့ report ခံရသူ id က profiles ရဲ့
///   uuid အမြဲဖြစ်တယ်။

const bodySchema = z.object({
  playerId: z.string().uuid(),
  room: z.string().max(16).optional(),
  reason: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON မမှန်ပါ" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "ပုံစံ မမှန်ပါ" }, { status: 400 });
  }
  const { playerId, room, reason } = parsed.data;
  if (playerId === profile.id) {
    return NextResponse.json({ error: "ကိုယ့်ကိုယ်ကို တိုင်လို့မရပါ" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("reports").insert({
    reporter_id: profile.id,
    profile_id: playerId,
    post_id: null,
    comment_id: null,
    // ★ Moderator က ဒီစာကို ဖတ်ပြီး voice ကလာမှန်း သိရမယ်
    reason: `[metaverse voice${room ? ` · ${room}` : ""}] ${reason || "အသံနှောင့်ယှက်မှု"}`.slice(
      0,
      500,
    ),
  });

  if (error) {
    return NextResponse.json({ error: "တိုင်ကြားလို့ မရပါ" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
