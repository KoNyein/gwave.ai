import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { getKvsViewerConfig, isKvsConfigured } from "@/lib/cctv-kvs";
import { getMyCamera, getSharedCamera } from "@/lib/db/cctv";

export const dynamic = "force-dynamic";

/**
 * POST /api/cctv/kvs — mint a KVS WebRTC viewer session for one camera.
 * Body: { id } (owner-only) or { token } (public share). Returns the channel
 * ARN, WSS endpoint, ICE servers and short-lived credentials the browser SDK
 * needs. AWS secrets never leave the server.
 */
export async function POST(request: NextRequest) {
  if (!isKvsConfigured()) {
    return NextResponse.json({ error: "KVS not configured" }, { status: 503 });
  }

  let body: { id?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Resolve the camera under the caller's own authorization.
  let camera: { camera_type: string; kvs_channel: string | null; kvs_region: string | null } | null =
    null;
  if (body.id) {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    }
    camera = await getMyCamera(profile.id, body.id);
  } else if (body.token) {
    // RLS decides visibility (public, or owner). rtsp_url is never selected.
    camera = await getSharedCamera(body.token);
  }

  if (!camera) {
    return NextResponse.json({ error: "Camera not found" }, { status: 404 });
  }
  if (camera.camera_type !== "kvs" || !camera.kvs_channel) {
    return NextResponse.json({ error: "Not a KVS camera" }, { status: 400 });
  }

  const config = await getKvsViewerConfig(camera.kvs_channel, camera.kvs_region);
  if (!config) {
    return NextResponse.json(
      { error: "Could not reach the KVS channel" },
      { status: 502 },
    );
  }

  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}
