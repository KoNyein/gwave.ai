import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";

/// လောကထဲက ကြော်ငြာသင်ပုန်း + မြို့လယ် မျက်နှာပြင် — Gwave ရဲ့ တကယ့်
/// အချက်အလက်ကို metaverse ထဲ ဆွဲထည့်တဲ့ နေရာ (Phase 5.7 + 5.8)။
///
/// ★ **အများပြည်သူ (public) အတွက်ပဲ** — metaverse က login မဝင်ဘဲ ဝင်လို့ရလို့
///   ဒီ endpoint က ဘယ်တော့မှ ကိုယ်ရေးကိုယ်တာ မထုတ်ရ။ `visibility = public`
///   နဲ့ group/page မဟုတ်တဲ့ ပို့စ်တွေကိုသာ ပြတယ်၊ ဖျက်ထားတာကို ချန်တယ်။
/// ★ **Resource embed မသုံးရ** — PostgREST ရဲ့ schema cache ဟောင်းသွားရင်
///   embed က 500 ပြန်ပြီး feature က တိတ်တိတ်သေတယ် (CLAUDE.md)။ ပို့စ်နဲ့
///   ရေးသူကို သီးခြားဆွဲပြီး code ထဲမှာ ပေါင်းတယ်။
/// ★ Cache — သင်ပုန်းက တစ်မိနစ်နောက်ကျလည်း ဘာမှမဖြစ်ဘူး၊ ဒါပေမယ့် လောကထဲက
///   လူတိုင်း တစ်မိနစ်တစ်ခါ ခေါ်ရင် RDS ကို အလကား ရိုက်နေတာ ဖြစ်လို့ CDN
///   အဆင့်မှာ ၆၀ စက္ကန့် သိမ်းခိုင်းတယ်။

export const dynamic = "force-dynamic";

const MAX_POSTS = 5;
const SNIPPET = 120;

type BoardPost = { id: string; author: string; text: string; at: string };

export async function GET() {
  const admin = createAdminClient();

  const [postsRes, liveRes] = await Promise.all([
    admin
      .from("posts")
      .select("id, author_id, content, created_at")
      .eq("visibility", "public")
      .is("group_id", null)
      .is("page_id", null)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_POSTS),
    // မြို့လယ် မျက်နှာပြင်အတွက် — ယခု တိုက်ရိုက်လွှင့်နေတဲ့ stream။
    // ★ IVS (HLS URL ရှိ) ကို ဦးစားပေးတယ် — screen မှာ တိုက်ရိုက် ဖွင့်လို့
    //   ရလို့။ LiveKit (ဖုန်း Go Live) ဆိုရင် URL မရှိပေမယ့် ခေါင်းစဉ်ကို
    //   screen placeholder မှာ ပြပေးတယ် ("app ထဲ ကြည့်ပါ")။
    admin
      .from("live_streams")
      .select("id, title, ivs_playback_url, created_at")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const rows = postsRes.data ?? [];

  // ── ရေးသူတွေကို သီးခြားဆွဲပြီး code ထဲမှာ ပေါင်း ──────────────────────
  const authorIds = [...new Set(rows.map((r) => r.author_id))];
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const profRes = await admin
      .from("profiles")
      .select("id, username, full_name")
      .in("id", authorIds);
    for (const p of profRes.data ?? []) {
      names.set(p.id, p.full_name || p.username || "Gwave");
    }
  }

  const posts: BoardPost[] = rows.map((r) => ({
    id: r.id,
    author: names.get(r.author_id) ?? "Gwave",
    // သင်ပုန်းက သေးလို့ အရှည်ကို ဖြတ်တယ် — texture ထဲ ထည့်တာမို့
    // စာလုံးများရင် ဖတ်လို့မရတော့ဘူး
    text: (r.content || "").replace(/\s+/g, " ").slice(0, SNIPPET),
    at: r.created_at,
  }));

  // IVS (ဖွင့်လို့ရတဲ့ URL ပါတာ) အရင်၊ မရှိမှ LiveKit (title ပဲ ပြ)
  const liveRows = liveRes.data ?? [];
  const ivsRow = liveRows.find((r) => r.ivs_playback_url);
  const anyRow = liveRows[0];
  const live = ivsRow
    ? { title: ivsRow.title, url: ivsRow.ivs_playback_url }
    : anyRow
      ? { title: anyRow.title, url: null }
      : null;

  return NextResponse.json(
    { posts, live },
    { headers: { "cache-control": "public, max-age=30, s-maxage=60" } },
  );
}
