import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { serverBroadcast } from "@/lib/realtime-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/call/signal — server-side relay for call signaling.
 *
 * Field debugging (build 183) showed a phone whose realtime socket RECEIVES
 * broadcasts fine while its SENDS silently vanish: the callee's accept
 * arrived, but the phone's offer/hangup never reached the peer — calls stuck
 * on "Connecting…" and hang-ups didn't propagate. The app therefore sends its
 * signaling through this endpoint (HTTP up, Realtime HTTP-broadcast out),
 * which is the delivery path already proven to reach web and app subscribers.
 * Receiving stays on the client's own socket.
 *
 * Scope: any authenticated user may broadcast the whitelisted call events to
 * a call:{callId} topic. Call ids are unguessable (caller-microseconds +
 * caller profile id) and carry no data besides the ephemeral signaling, so
 * pre-launch this is an accepted trade for reliable calls; tighten with a
 * participants check if call rows ever land in the DB.
 */
const schema = z.object({
  callId: z.string().min(6).max(120),
  event: z.enum([
    "accept",
    "offer",
    "answer",
    "ice",
    "decline",
    "hangup",
    "cancel",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
  /** For `cancel`: also notify this user's ring inbox (calls:{ringUserId}). */
  ringUserId: z.string().uuid().optional(),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // SDP offers are a few KB; anything huge is not a signaling message.
  const length = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(length) || length > 64_000) {
    return NextResponse.json({ error: "Body too large." }, { status: 413 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { callId, event, payload, ringUserId } = parsed.data;

  const jobs = [
    serverBroadcast(`call:${callId}`, event, payload ?? {}),
    ...(event === "cancel" && ringUserId
      ? [serverBroadcast(`calls:${ringUserId}`, "cancel", { callId })]
      : []),
  ];
  const ok = (await Promise.all(jobs)).every(Boolean);
  console.log(
    `[call/signal] from=${claims.sub} call=${callId} event=${event} ok=${ok}`,
  );
  return NextResponse.json({ ok });
}
