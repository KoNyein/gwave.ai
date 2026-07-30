import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin watchlist for Wi-Fi networks worth keeping an eye on — border scam
 * compounds being the case this was built for.
 *
 * The judgement is deliberately human and attributable: an admin records a
 * risk level, a category and a note, and their id is stamped on it. Nothing
 * here auto-classifies a network, because a Wi-Fi scan cannot prove what a
 * building is used for and a wrong label on a legitimate business is a real
 * harm. wifi_watchlist is RLS-sealed; this route is the only door.
 */
const schema = z.object({
  bssid: z.string().trim().min(6).max(64),
  risk: z.enum(["watch", "suspect", "confirmed", "cleared"]),
  category: z
    .enum(["scam_compound", "phishing_ap", "unknown_cluster", "other"])
    .default("other"),
  note: z.string().trim().min(3).max(500),
});

async function adminId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return profile?.role === "admin" ? profile.id : null;
}

export async function POST(request: NextRequest) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid flag." }, { status: 400 });
  }
  const f = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("wifi_watchlist").upsert(
    {
      bssid: f.bssid.toLowerCase(),
      risk: f.risk,
      category: f.category,
      note: f.note,
      flagged_by: me,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bssid" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[wifi/watchlist] flag by=${me} ${f.bssid} ${f.risk}/${f.category}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const me = await adminId();
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const bssid = request.nextUrl.searchParams.get("bssid");
  if (!bssid) {
    return NextResponse.json({ error: "bssid required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("wifi_watchlist")
    .delete()
    .eq("bssid", bssid.toLowerCase());
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[wifi/watchlist] unflag by=${me} ${bssid}`);
  return NextResponse.json({ ok: true });
}
