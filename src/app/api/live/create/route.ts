import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { getMux } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

/**
 * POST /api/live/create — provision a Mux live stream for the signed-in
 * user and store it. The stream key is written ONLY to live_stream_keys
 * (host-only RLS); the response echoes it once for immediate display.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  let mux;
  try {
    mux = getMux();
  } catch {
    return NextResponse.json(
      { error: "Live streaming is not configured on this server." },
      { status: 503 },
    );
  }

  try {
    const stream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      // Keep the room open across brief encoder drops.
      reconnect_window: 60,
    });

    const playbackId = stream.playback_ids?.[0]?.id ?? null;
    if (!stream.id || !stream.stream_key) {
      return NextResponse.json(
        { error: "Mux did not return a usable stream." },
        { status: 502 },
      );
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("live_streams")
      .insert({
        host_id: profile.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        mux_stream_id: stream.id,
        mux_playback_id: playbackId,
      })
      .select("id")
      .single();
    if (error || !row) {
      // Don't leave an orphaned Mux stream behind.
      await mux.video.liveStreams.delete(stream.id).catch(() => undefined);
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the stream." },
        { status: 500 },
      );
    }

    const { error: keyError } = await admin
      .from("live_stream_keys")
      .insert({ stream_id: row.id, stream_key: stream.stream_key });
    if (keyError) {
      await admin.from("live_streams").delete().eq("id", row.id);
      await mux.video.liveStreams.delete(stream.id).catch(() => undefined);
      return NextResponse.json({ error: keyError.message }, { status: 500 });
    }

    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mux request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
