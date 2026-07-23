import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/heartbeat — presence ping. The browser calls this every minute
 * while a signed-in page is open; profiles.last_seen_at drives the messenger
 * "Active now" dots (in the app and, later, on the web). Errors are swallowed:
 * presence is cosmetic and must never surface as a failure, including before
 * the last_seen_at column is deployed.
 */
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });
  const db = await createClient();
  await db
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", profile.id)
    .then(
      () => undefined,
      () => undefined,
    );
  return NextResponse.json({ ok: true });
}
