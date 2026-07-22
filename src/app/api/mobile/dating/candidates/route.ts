import { NextRequest, NextResponse } from "next/server";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The swipe deck: active dating profiles the caller hasn't swiped yet, matched
// both ways against the stated preferences (mine about them, theirs about me).

type DatingProfile = {
  user_id: string;
  display_name: string;
  birth_year: number;
  gender: string;
  looking_for: string;
  bio: string;
  city: string;
  photos: unknown;
  active: boolean;
  created_at: string;
};

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

/** GET /api/mobile/dating/candidates — up to 30 unswiped candidates. */
export async function GET(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: meRow, error: meError } = await admin
    .from("dating_profiles")
    .select("user_id, gender, looking_for")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (meError) {
    return NextResponse.json({ error: meError.message }, { status: 500 });
  }
  if (!meRow) {
    return NextResponse.json(
      { error: "Set up your dating profile first." },
      { status: 400 },
    );
  }
  const me = meRow as { user_id: string; gender: string; looking_for: string };

  // Everyone I've already swiped on stays out of the deck.
  const { data: swipedRows } = await admin
    .from("dating_swipes")
    .select("target_id")
    .eq("swiper_id", claims.sub)
    .limit(5000);
  const excluded = new Set<string>([claims.sub]);
  for (const row of swipedRows ?? []) {
    excluded.add((row as { target_id: string }).target_id);
  }

  let query = admin
    .from("dating_profiles")
    .select(
      "user_id, display_name, birth_year, gender, looking_for, bio, city, photos, active, created_at",
    )
    .eq("active", true)
    .neq("user_id", claims.sub)
    // They must be open to my gender (or to anyone).
    .in("looking_for", ["any", me.gender])
    .order("created_at", { ascending: false })
    .limit(200);
  // And they must be what I'm looking for.
  if (me.looking_for !== "any") query = query.eq("gender", me.looking_for);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const candidates = ((data ?? []) as DatingProfile[])
    .filter((c) => !excluded.has(c.user_id))
    .slice(0, 30);
  return NextResponse.json({ candidates });
}
