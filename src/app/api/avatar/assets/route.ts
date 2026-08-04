import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import type { AvatarAsset, AvatarAssetKind } from "@/features/avatar/types";

/// 🧬 Avatar asset library (spec §7) — skins/hair/outfits/bodies စာရင်း။
///
/// ★ **Flat query နှစ်ခု၊ embed မသုံး** — PostgREST schema cache ဟောင်းရင်
///   embed က 500 ပြန်တယ် (CLAUDE.md hot-path rule)။ ဒီ endpoint က editor
///   ဖွင့်တိုင်း ခေါ်တာမို့ hot-path ပဲ။
/// ★ Login မဝင်လည်း default library မြင်ရတယ် — owned flag ပဲ false ဖြစ်မယ်။

export const dynamic = "force-dynamic";

const KINDS = new Set(["outfit", "hair", "body", "accessory"]);

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const admin = createAdminClient();

  let q = admin
    .from("avatar_assets")
    .select("id, kind, name, glb_url, thumb_url, is_default, price")
    .order("id");
  if (kind && KINDS.has(kind)) q = q.eq("kind", kind);

  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Library ဖတ်လို့ မရပါ" }, { status: 500 });
  }

  // Owned flags — flat query ‌နဲ့ သီးခြားဆွဲပြီး code ထဲ ပေါင်း
  const owned = new Set<string>();
  const profile = await getCurrentProfile();
  if (profile) {
    const { data: inv } = await admin
      .from("avatar_inventory")
      .select("asset_id")
      .eq("user_id", profile.id);
    for (const r of inv ?? []) owned.add(r.asset_id);
  }

  const assets: AvatarAsset[] = (rows ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as AvatarAssetKind,
    name: r.name,
    glbUrl: r.glb_url,
    thumbUrl: r.thumb_url,
    isDefault: r.is_default === true,
    price: Number(r.price) || 0,
    owned: r.is_default === true || owned.has(r.id),
  }));

  return NextResponse.json(
    { assets },
    { headers: { "cache-control": "no-store, private" } },
  );
}
