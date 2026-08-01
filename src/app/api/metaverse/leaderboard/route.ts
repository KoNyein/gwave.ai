import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// Mini-game leaderboard (Phase 16.5)。
///
/// ★ **တစ်ပတ်စာ ရော all-time ရော** ပြရမယ်။ All-time ပဲပြရင် နောက်ကျမှ
///   စတဲ့သူက ထိပ်ဆုံးကို ဘယ်တော့မှ မမီဘူးလို့ ခံစားရပြီး လက်လျှော့သွားမယ်။
/// ★ Player တစ်ယောက်ရဲ့ **အကောင်းဆုံး တစ်ခါ** ကိုပဲ ရေတွက်တယ် — မဟုတ်ရင်
///   အကြိမ်များများ ကစားသူက စာရင်းတစ်ခုလုံးကို ဖုံးသွားမယ်။
/// ★ Aggregate ကို PostgREST မှာ မလုပ်ဘူး — resource embed / RPC မသုံးဘဲ
///   flat query နဲ့ ဆွဲပြီး code ထဲမှာ စုတယ် (CLAUDE.md ရဲ့ စည်းမျဉ်း)。

const GAME_IDS = new Set(["race", "hunt", "targets", "grow"]);
const FETCH_LIMIT = 400;
const TOP_N = 20;

type Row = {
  user_id: string;
  name: string | null;
  score: number;
  played_at: string;
};

type Entry = { userId: string; name: string; score: number; playedAt: string };

/// အကောင်းဆုံးအမှတ်ကိုသာ ချန်ပြီး အစဉ်လိုက် စီတယ်။
function best(rows: Row[]): Entry[] {
  const byUser = new Map<string, Entry>();
  for (const r of rows) {
    const cur = byUser.get(r.user_id);
    if (!cur || r.score > cur.score) {
      byUser.set(r.user_id, {
        userId: r.user_id,
        name: r.name || "Gwave",
        score: r.score,
        playedAt: r.played_at,
      });
    }
  }
  return [...byUser.values()].sort((a, b) => b.score - a.score).slice(0, TOP_N);
}

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("game") || "race";
  if (!GAME_IDS.has(gameId)) {
    return NextResponse.json({ error: "ဒီပွဲ မရှိပါ" }, { status: 400 });
  }

  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [allTime, weekly] = await Promise.all([
    admin
      .from("mv_game_scores")
      .select("user_id, name, score, played_at")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .limit(FETCH_LIMIT),
    admin
      .from("mv_game_scores")
      .select("user_id, name, score, played_at")
      .eq("game_id", gameId)
      .gte("played_at", weekAgo)
      .order("score", { ascending: false })
      .limit(FETCH_LIMIT),
  ]);

  return NextResponse.json(
    {
      gameId,
      allTime: best((allTime.data ?? []) as Row[]),
      weekly: best((weekly.data ?? []) as Row[]),
    },
    // ★ ၆၀ စက္ကန့် cache — ပွဲပြီးတိုင်း ချက်ချင်း မပြောင်းလည်း ရတယ်၊
    // ဒါပေမယ့် DB ကို ကြည့်သူတိုင်း တစ်ခါစီ ခေါ်တာက အလွန်များတယ်။
    { headers: { "cache-control": "public, max-age=0, s-maxage=60" } },
  );
}
