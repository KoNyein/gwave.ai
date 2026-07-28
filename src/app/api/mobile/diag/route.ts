import { NextRequest, NextResponse } from "next/server";

import { verifyDataToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/diag — a diagnostics beacon from the native app.
 *
 * The app periodically posts a small JSON blob of its client-side state
 * (build number, ring-socket status, runtime-config flag, last heartbeat
 * error, …) and this route just logs it. That makes the phone's internals
 * visible in `docker logs gwave-web` — debugging the call stack previously
 * required asking the user for screenshots of the Settings footer, because
 * a phone whose realtime socket had silently died looked healthy from the
 * server. Auth'd so noise can't be injected; body capped; never fails the
 * app (always 200 for a valid user).
 */
function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    /* unreadable body — still log the beacon itself */
  }
  console.log(
    `[diag] user=${claims.sub}`,
    JSON.stringify(body ?? {}).slice(0, 600),
  );
  return NextResponse.json({ ok: true });
}
