import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import {
  DEFAULT_AVATAR,
  FREE_ACCESSORIES,
  sanitizeAvatar,
} from "@/components/metaverse/avatar/config";

export const dynamic = "force-dynamic";

/// Avatar သိမ်း/ဖတ် (Phase 15.4)。
///
/// ★ **Client မှာ 🔒 ပြထားရုံနဲ့ မလုံခြုံဘူး** — ဒီ endpoint ကို တိုက်ရိုက်
///   ခေါ်ပြီး မပိုင်တဲ့ သရဖူကို ထည့်လို့ရမယ်။ ဒါကြောင့် `mv_inventory` ကို
///   ကြည့်ပြီး ပိုင်တာကိုသာ ချန်တယ် (`sanitizeAvatar` ရဲ့ `owned` argument)။
/// ★ မပိုင်တဲ့ပစ္စည်းဆိုရင် **ငြင်းမယ့်အစား ဖယ်တယ်** — ဦးထုပ်တစ်ခုကြောင့်
///   avatar တစ်ခုလုံး မသိမ်းရတာက အသုံးမဝင်ဘူး။

async function ownedSkus(userId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mv_inventory")
    .select("sku, qty")
    .eq("user_id", userId)
    .gt("qty", 0);
  const owned = new Set(FREE_ACCESSORIES);
  for (const row of data ?? []) owned.add(row.sku);
  return owned;
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { config: DEFAULT_AVATAR, owned: [...FREE_ACCESSORIES] },
      { headers: { "cache-control": "no-store, private" } },
    );
  }

  const admin = createAdminClient();
  const [{ data: row }, owned] = await Promise.all([
    admin
      .from("mv_players")
      .select("avatar_config")
      .eq("user_id", profile.id)
      .maybeSingle(),
    ownedSkus(profile.id),
  ]);

  return NextResponse.json(
    {
      config: row?.avatar_config
        ? sanitizeAvatar(row.avatar_config, owned)
        : DEFAULT_AVATAR,
      owned: [...owned],
    },
    { headers: { "cache-control": "no-store, private" } },
  );
}

export async function POST(request: NextRequest) {
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

  const owned = await ownedSkus(profile.id);
  const config = sanitizeAvatar((body as { config?: unknown })?.config, owned);

  const admin = createAdminClient();
  const { error } = await admin.from("mv_players").upsert(
    {
      user_id: profile.id,
      display_name: profile.username || profile.full_name || "Gwave",
      avatar_config: config,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: "သိမ်းလို့ မရပါ" }, { status: 500 });
  }

  // ★ သန့်စင်ပြီးသား config ကို ပြန်ပေးတယ် — client က ဘာ ဖယ်လိုက်လဲ
  // သိရမယ် (မပိုင်တဲ့ ပစ္စည်း ဖယ်ခံရရင် UI မှာ ပြန်ပြရမယ်)。
  return NextResponse.json(
    { ok: true, config },
    { headers: { "cache-control": "no-store, private" } },
  );
}
