import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import {
  BRIDGE_PUBLISH_USER,
  bridgeHlsBase,
  bridgePathForStream,
  bridgePublishBase,
  isBridgeConfigured,
  mintBridgeToken,
} from "@/lib/cctv/bridge";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/cctv/bridge — start (or resume) a Camera Bridge session.
 *
 * The app relays a local camera's RTSP out to MediaMTX (deploy/cctv-bridge/),
 * which is what makes router-less / CGNAT cameras viewable. This endpoint
 * mints the outbound publish credential and owns the camera row:
 *  - no cameraId → create an rtsp camera (hls_url pointing at the bridge
 *    path) and return its publish URL + token
 *  - cameraId    → owner check, refresh the token for the existing row
 *
 * The camera's LOCAL RTSP URL (with its password) never reaches this server —
 * it stays on the phone.
 */
const schema = z.object({
  cameraId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
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
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  if (!isBridgeConfigured()) {
    return NextResponse.json(
      { error: "Camera Bridge is not configured on this server." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  let cameraId: string;
  let streamId: string;
  let title: string;

  if (parsed.data.cameraId) {
    const { data: cam } = await admin
      .from("user_cameras")
      .select("id, owner_id, stream_id, title")
      .eq("id", parsed.data.cameraId)
      .maybeSingle();
    if (!cam || cam.owner_id !== claims.sub) {
      return NextResponse.json({ error: "Camera not found." }, { status: 404 });
    }
    cameraId = cam.id;
    streamId = cam.stream_id;
    title = cam.title;
  } else {
    streamId = `cam_${randomBytes(6).toString("hex")}`;
    title = parsed.data.title ?? "Bridge camera";
    const hlsUrl = `${bridgeHlsBase()}/${bridgePathForStream(streamId)}/index.m3u8`;
    const { data, error } = await admin
      .from("user_cameras")
      .insert({
        owner_id: claims.sub,
        title,
        camera_type: "rtsp",
        stream_id: streamId,
        share_token: randomBytes(16).toString("hex"),
        is_public: false,
        hls_url: hlsUrl,
        zone: "bridge",
      })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "Could not save the camera." },
        { status: 500 },
      );
    }
    cameraId = (data as { id: string }).id;
  }

  const path = bridgePathForStream(streamId);
  const { token, expiresAtMs } = mintBridgeToken(path);
  return NextResponse.json({
    cameraId,
    title,
    path,
    publishUrl: `${bridgePublishBase()}/${path}`,
    username: BRIDGE_PUBLISH_USER,
    password: token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    hlsUrl: `${bridgeHlsBase()}/${path}/index.m3u8`,
  });
}
