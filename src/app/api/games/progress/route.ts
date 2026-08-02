import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// Game progress + quests — cross-device sync။
///
/// ★ Client (localStorage) က အမြဲ အလုပ်လုပ်တယ် — ဒီ API က signed-in
///   user အတွက် **ဖြည့်စွက်** sync သာ။ Login မဝင်ရင် 401 ပြန်ပြီး client
///   က local နဲ့ ဆက်သွားတယ်။
/// ★ best က server မှာ **greatest(old, new)** — device အဟောင်းက တန်ဖိုးနိမ့်
///   ပို့လာလည်း မကျသွားဘူး။ data (jsonb) ကတော့ key-level merge။

const GAME_RE = /^[a-z0-9-]{2,40}$/;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "login လိုသည်" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("game_progress")
    .select("game, best, data")
    .eq("profile_id", profile.id);
  if (error) return NextResponse.json({ error: "မဆွဲနိုင်ပါ" }, { status: 500 });

  const progress: Record<string, { best: number; data: Record<string, unknown> }> = {};
  for (const row of (data ?? []) as { game: string; best: number; data: Record<string, unknown> }[]) {
    progress[row.game] = { best: row.best, data: row.data ?? {} };
  }
  return NextResponse.json({ progress });
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "login လိုသည်" }, { status: 401 });

  let body: { game?: string; best?: number; data?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON မမှန်ပါ" }, { status: 400 });
  }
  const game = String(body.game ?? "");
  if (!GAME_RE.test(game)) return NextResponse.json({ error: "game မမှန်ပါ" }, { status: 400 });
  const best = Math.max(0, Math.min(1_000_000, Math.floor(Number(body.best) || 0)));
  const patch = body.data && typeof body.data === "object" ? body.data : {};
  // Payload ကြီးကြီး မခံဘူး — quest counters လောက်ပဲ လိုတယ်
  if (JSON.stringify(patch).length > 4000) {
    return NextResponse.json({ error: "data ကြီးလွန်းသည်" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("game_progress")
    .select("best, data")
    .eq("profile_id", profile.id)
    .eq("game", game)
    .limit(1);
  const existing = rows?.[0] as { best: number; data: Record<string, unknown> } | undefined;

  const merged = {
    profile_id: profile.id,
    game,
    best: Math.max(existing?.best ?? 0, best),
    data: { ...(existing?.data ?? {}), ...patch },
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from("game_progress")
    .upsert(merged, { onConflict: "profile_id,game" });
  if (error) return NextResponse.json({ error: "မသိမ်းနိုင်ပါ" }, { status: 500 });

  return NextResponse.json({ ok: true, best: merged.best });
}
