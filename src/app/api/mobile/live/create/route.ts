import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createIvsChannel, deleteIvsChannel, ivsIsDefaultProvider } from "@/lib/ivs";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/live/create — provision a broadcast for the native app.
 *
 * The app streams RTMPS straight from the phone camera (native encoder), so
 * this is the bearer-authed twin of the web's IVS Low-Latency "rtmp" mode:
 * create an IVS channel, store the stream row + host-only key, and — unlike
 * the web flow, which shows the key for OBS — return the ingest URL + key
 * once so the app can start its encoder immediately.
 */
const schema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  // Optional location tag (shown as a pin on the live card).
  locationName: z.string().trim().max(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
    return NextResponse.json({ error: "Give the broadcast a title." }, { status: 400 });
  }

  if (!ivsIsDefaultProvider()) {
    return NextResponse.json(
      { error: "Live broadcasting isn't enabled on this server." },
      { status: 503 },
    );
  }

  let channel;
  try {
    channel = await createIvsChannel(`gwave-${claims.sub.slice(0, 8)}`);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error && /security token|credentials|AccessDenied/i.test(e.message)
            ? "IVS permissions are missing on this server's IAM role."
            : "Failed to provision the live channel.",
      },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("live_streams")
    .insert({
      host_id: claims.sub,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      ivs_channel_arn: channel.channelArn,
      ivs_ingest_url: channel.ingestUrl,
      ivs_playback_url: channel.playbackUrl,
      kind: "stream",
      ...(parsed.data.locationName
        ? { location_name: parsed.data.locationName }
        : {}),
      ...(parsed.data.latitude !== undefined &&
      parsed.data.longitude !== undefined
        ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
        : {}),
    })
    .select("id")
    .single();
  if (error || !row) {
    await deleteIvsChannel(channel.channelArn);
    return NextResponse.json(
      { error: error?.message ?? "Failed to save the stream." },
      { status: 500 },
    );
  }

  const { error: keyError } = await admin
    .from("live_stream_keys")
    .insert({ stream_id: row.id, stream_key: channel.streamKey });
  if (keyError) {
    await admin.from("live_streams").delete().eq("id", row.id);
    await deleteIvsChannel(channel.channelArn);
    return NextResponse.json({ error: keyError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: row.id,
      ingestUrl: channel.ingestUrl,
      streamKey: channel.streamKey,
      playbackUrl: channel.playbackUrl,
    },
    { status: 201 },
  );
}
