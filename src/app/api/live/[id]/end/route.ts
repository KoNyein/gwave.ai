import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { getMux } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();

/**
 * POST /api/live/[id]/end — host-only. Signals Mux to finish the broadcast
 * and marks the stream ended immediately (the webhook would eventually do
 * the same, this just makes the UI instant).
 */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!uuid.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid stream id." }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: stream } = await admin
    .from("live_streams")
    .select("id, host_id, mux_stream_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (stream.host_id !== profile.id) {
    return NextResponse.json({ error: "Host only." }, { status: 403 });
  }
  if (stream.status === "ended") {
    return NextResponse.json({ ok: true });
  }

  try {
    const mux = getMux();
    // complete() ends an in-progress broadcast; disable() stops future ones.
    await mux.video.liveStreams
      .complete(stream.mux_stream_id)
      .catch(() => undefined);
    await mux.video.liveStreams
      .disable(stream.mux_stream_id)
      .catch(() => undefined);
  } catch {
    // Mux not configured — still end it locally so the UI is consistent.
  }

  const { error } = await admin
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", stream.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
