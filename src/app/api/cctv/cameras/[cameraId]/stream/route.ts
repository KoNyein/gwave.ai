import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createAuthorizedCameraPlaybackSession } from "@/lib/cctv/camera-service";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  shareToken: z.string().min(8).max(100).optional(),
});

/**
 * POST /api/cctv/cameras/[cameraId]/stream — a fresh short-lived playback
 * session for one camera (§11.5). Anonymous viewers pass the share token;
 * vendor-cloud cameras resolve only for their owner (public sharing is
 * provider-gated and off). Rate-limited; never cached; never returns
 * vendor tokens or raw RTSP.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ cameraId: string }> },
) {
  const params = await props.params;
  if (!(await checkAuthRateLimit("cam_stream", 30, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = bodySchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const user = await getCurrentUser();
  const result = await createAuthorizedCameraPlaybackSession({
    cameraId: params.cameraId,
    userId: user?.id ?? null,
    shareToken: body.data.shareToken ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { session: result.session },
    { headers: { "Cache-Control": "no-store" } },
  );
}
