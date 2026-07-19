import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { stopIvsStream } from "@/lib/ivs";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();

/**
 * POST /api/live/[id]/delete — host-only. The "End + delete" path of the
 * end-stream dialog: stops the broadcast (best-effort) and removes the stream
 * row entirely, so it never appears in Recent broadcasts and any recording
 * reference is dropped with it.
 */
export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
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
    .select("id, host_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!stream) return NextResponse.json({ ok: true });
  if (stream.host_id !== profile.id) {
    return NextResponse.json({ error: "Host only." }, { status: 403 });
  }

  if (process.env.NEXT_PUBLIC_LIVE_PROVIDER === "ivs") {
    const { data: rec } = await admin
      .from("live_streams")
      .select("ivs_channel_arn")
      .eq("id", stream.id)
      .maybeSingle();
    if (rec?.ivs_channel_arn) await stopIvsStream(rec.ivs_channel_arn);
  }

  const { error } = await admin
    .from("live_streams")
    .delete()
    .eq("id", stream.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
