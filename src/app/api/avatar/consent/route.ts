import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

/// 🔒 Biometric consent (spec §10) — face scan မလုပ်ခင် မဖြစ်မနေ။
/// consented_at ကို upsert နဲ့ မှတ်တယ် — upload route က ဒါကို စစ်တယ်။

export const dynamic = "force-dynamic";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("mv_scan_avatars").upsert(
    {
      user_id: profile.id,
      consented_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return NextResponse.json({ error: "သိမ်းလို့ မရပါ" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
