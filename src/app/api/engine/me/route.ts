import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/engine/me — signed-in identity for the Studio header.
 * The Studio page runs off the gw_at cookie like every web page; this just
 * turns it into a display name (401 = show the Sign in button).
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({
    id: profile.id,
    name: profile.full_name ?? profile.username ?? "Creator",
  });
}
