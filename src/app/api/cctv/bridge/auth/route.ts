import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  BRIDGE_PUBLISH_USER,
  verifyBridgeToken,
} from "@/lib/cctv/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cctv/bridge/auth — MediaMTX authHTTPAddress webhook
 * (deploy/cctv-bridge/mediamtx.yml). Called by the LOCAL MediaMTX for every
 * publish attempt; read/playback actions are excluded in its config, so the
 * only thing this route ever grants is "may this publisher write this path".
 *
 * Contract: 2xx = allow, anything else = deny. Always deny-by-default —
 * an unexpected payload must never become an open relay. Passwords here are
 * OUR minted HMAC tokens, never user credentials, and are never logged.
 */
const schema = z.object({
  user: z.string().default(""),
  password: z.string().default(""),
  action: z.string().default(""),
  path: z.string().default(""),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "denied" }, { status: 401 });
  }
  const { user, password, action, path } = parsed.data;
  const ok =
    action === "publish" &&
    user === BRIDGE_PUBLISH_USER &&
    verifyBridgeToken(path, password);
  if (!ok) {
    return NextResponse.json({ error: "denied" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
