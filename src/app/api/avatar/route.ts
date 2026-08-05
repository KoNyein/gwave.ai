import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import {
  DEFAULT_SCAN_AVATAR,
  sanitizeMorphs,
  type AvatarConfig,
} from "@/features/avatar/types";

/// 🧬 Scan-avatar config (spec §7 API) — Phase 1။
///
/// ★ GET ?userId= က **public read** — room ထဲက client တိုင်း တခြားသူရဲ့
///   avatar ကို ဆွဲပြရလို့ (spec §9)။ ဒါပေမယ့် ကိုယ်ရေးအချက်အလက် မပါဘူး —
///   config သက်သက်ပဲ ပြန်တယ်။
/// ★ PUT က ကိုယ့် config ကိုပဲ — auth မဖြစ်မနေ၊ version ကို server ကသာ
///   တိုးတယ် (client တင်လာတဲ့ version ကို ယုံလို့မရ — cache-bust သဘော)။
/// ★ URL field တွေက **ကိုယ့် S3 folder က လာတာပဲ လက်ခံ** — မဟုတ်ရင်
///   တခြားသူ့ပုံ/glb ကို ကိုယ့် avatar အဖြစ် ချိတ်လို့ရသွားမယ်။

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

const putSchema = z.object({
  config: z.object({
    faceGlbUrl: z.string().max(500).nullable().optional(),
    faceThumbUrl: z.string().max(500).nullable().optional(),
    bodyType: z.enum(["m", "f"]).optional(),
    morphs: z.unknown().optional(),
    skinColor: z.string().regex(HEX).optional(),
    hairId: z.string().max(60).nullable().optional(),
    hairColor: z.string().regex(HEX).nullable().optional(),
    outfitId: z.string().max(60).optional(),
    accessories: z.array(z.string().max(60)).max(16).optional(),
  }),
});

type Row = {
  face_glb_url: string | null;
  face_thumb_url: string | null;
  body_type: string;
  morphs: unknown;
  skin_color: string;
  hair_id: string | null;
  hair_color: string | null;
  outfit_id: string;
  accessories: unknown;
  scan_source: string;
  version: number;
};

function rowToConfig(row: Row): AvatarConfig {
  return {
    faceGlbUrl: row.face_glb_url,
    faceThumbUrl: row.face_thumb_url,
    bodyType: row.body_type === "f" ? "f" : "m",
    morphs: sanitizeMorphs(row.morphs),
    skinColor: HEX.test(row.skin_color) ? row.skin_color : "#c99e7f",
    hairId: row.hair_id,
    hairColor: row.hair_color,
    outfitId: row.outfit_id || "casual_01",
    accessories: Array.isArray(row.accessories)
      ? row.accessories.filter((a): a is string => typeof a === "string")
      : [],
    scanSource:
      row.scan_source === "face" || row.scan_source === "face+body"
        ? row.scan_source
        : "none",
    version: Number(row.version) || 1,
  };
}

/// ကိုယ့် S3 namespace (avatars/{uid}/…) က URL ပဲ ခွင့်ပြု — CDN ရော
/// same-origin ရော နှစ်မျိုးလုံး လက်ခံတယ်
function ownedUrl(url: unknown, userId: string): string | null {
  if (typeof url !== "string" || url.length === 0 || url.length > 500) {
    return null;
  }
  try {
    const path = url.startsWith("/")
      ? url
      : new URL(url).pathname;
    return path.includes(`avatars/${userId}/`) ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const admin = createAdminClient();

  let targetId = userId;
  let ownId: string | null = null;
  if (!targetId) {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json(
        { config: DEFAULT_SCAN_AVATAR },
        { headers: { "cache-control": "no-store, private" } },
      );
    }
    targetId = profile.id;
    // ကိုယ့် config ဖတ်တဲ့အခါ ကိုယ့် id ပါ ပြန်ပေး — STRIKE လို same-origin
    // client တွေက room ထဲ avatarId ကြေညာဖို့ သုံးတယ် (room peer တွေ မြင်ပြီးသား
    // id မို့ secret မဟုတ်ဘူး)။
    ownId = profile.id;
  }

  const { data: row } = await admin
    .from("mv_scan_avatars")
    .select(
      "face_glb_url, face_thumb_url, body_type, morphs, skin_color, hair_id, hair_color, outfit_id, accessories, scan_source, version",
    )
    .eq("user_id", targetId)
    .maybeSingle();

  return NextResponse.json(
    {
      config: row ? rowToConfig(row as Row) : DEFAULT_SCAN_AVATAR,
      ...(ownId ? { userId: ownId } : {}),
    },
    {
      headers: userId
        ? // Public read — room join မှာ လူတိုင်းဆွဲလို့ CDN မှာ ခဏ သိမ်းခိုင်း
          { "cache-control": "public, max-age=30, s-maxage=60" }
        : { "cache-control": "no-store, private" },
    },
  );
}

export async function PUT(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Config မမှန်ပါ" }, { status: 400 });
  }
  const c = parsed.data.config;

  const faceGlb = ownedUrl(c.faceGlbUrl, profile.id);
  const faceThumb = ownedUrl(c.faceThumbUrl, profile.id);

  const admin = createAdminClient();
  // ★ version = coalesce(old,0)+1 — upsert တစ်ချက်တည်းနဲ့ atomically တိုးဖို့
  //   ရှိပြီးသား row ကို အရင်ဖတ်တယ် (race က နောက်ဆုံးရေးတဲ့သူနိုင် — ကိုယ့်
  //   row ကို ကိုယ်ပဲ ရေးလို့ လက်ခံနိုင်တယ်)။
  const { data: existing } = await admin
    .from("mv_scan_avatars")
    .select("version, consented_at, scan_source")
    .eq("user_id", profile.id)
    .maybeSingle();

  const { data: saved, error } = await admin
    .from("mv_scan_avatars")
    .upsert(
      {
        user_id: profile.id,
        face_glb_url: faceGlb,
        face_thumb_url: faceThumb,
        body_type: c.bodyType === "f" ? "f" : "m",
        morphs: sanitizeMorphs(c.morphs),
        skin_color: c.skinColor && HEX.test(c.skinColor) ? c.skinColor : "#c99e7f",
        hair_id: c.hairId ?? null,
        hair_color: c.hairColor ?? null,
        outfit_id: c.outfitId || "casual_01",
        accessories: (c.accessories ?? []).slice(0, 16),
        // Scan URL ပါရင် face scan လုပ်ပြီးသား — Phase 2 မှာ body ထပ်လာမယ်
        scan_source: faceGlb ? (existing?.scan_source === "face+body" ? "face+body" : "face") : "none",
        version: (Number(existing?.version) || 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(
      "face_glb_url, face_thumb_url, body_type, morphs, skin_color, hair_id, hair_color, outfit_id, accessories, scan_source, version",
    )
    .single();

  if (error || !saved) {
    return NextResponse.json({ error: "သိမ်းလို့ မရပါ" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, config: rowToConfig(saved as Row) },
    { headers: { "cache-control": "no-store, private" } },
  );
}
