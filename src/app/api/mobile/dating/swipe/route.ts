import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

const schema = z.object({
  targetId: z.string().uuid(),
  liked: z.boolean(),
});

/**
 * POST /api/mobile/dating/swipe — record a like/pass. When the like is mutual
 * a match row is created (pair stored sorted so it's unique either way) and
 * `matched: true` comes back so the app can celebrate + open the chat.
 */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid swipe." }, { status: 400 });
  }
  const { targetId, liked } = parsed.data;
  if (targetId === claims.sub) {
    return NextResponse.json({ error: "That's you." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: swipeError } = await admin.from("dating_swipes").upsert(
    { swiper_id: claims.sub, target_id: targetId, liked },
    { onConflict: "swiper_id,target_id" },
  );
  if (swipeError) {
    return NextResponse.json({ error: swipeError.message }, { status: 500 });
  }
  if (!liked) return NextResponse.json({ matched: false });

  // Mutual like?
  const { data: reciprocal } = await admin
    .from("dating_swipes")
    .select("liked")
    .eq("swiper_id", targetId)
    .eq("target_id", claims.sub)
    .eq("liked", true)
    .maybeSingle();
  if (!reciprocal) return NextResponse.json({ matched: false });

  const [a, b] = [claims.sub, targetId].sort();
  const { error: matchError } = await admin.from("dating_matches").upsert(
    { user_a: a, user_b: b },
    { onConflict: "user_a,user_b", ignoreDuplicates: true },
  );
  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }
  return NextResponse.json({ matched: true });
}
