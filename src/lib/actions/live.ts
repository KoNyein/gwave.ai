"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/posts";
import { livekitConfigured, livekitUrl, mintLivekitToken } from "@/lib/livekit";
import { createClient } from "@/lib/supabase/server";

export interface LiveStageToken {
  url: string;
  token: string;
  canPublish: boolean;
}

/**
 * Mint a LiveKit token for a single-broadcaster Live stream. The host gets a
 * publish token (camera/mic/screen); everyone else subscribes only — so one
 * broadcaster reaches thousands of viewers through the SFU.
 */
export async function getLiveStageToken(
  streamId: string,
): Promise<ActionResult<LiveStageToken>> {
  if (!livekitConfigured()) return { ok: false, error: "SFU not configured" };
  const url = livekitUrl();
  if (!url) return { ok: false, error: "SFU not configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: stream } = await supabase
    .from("live_streams")
    .select("id, host_id, status, livekit_room")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (!stream.livekit_room) {
    return { ok: false, error: "This stream is not a LiveKit stream." };
  }
  if (stream.status === "ended") {
    return { ok: false, error: "This broadcast has ended." };
  }

  const isHost = stream.host_id === user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const name =
    profile?.full_name?.trim() || profile?.username?.trim() || "Guest";

  const token = await mintLivekitToken({
    room: stream.livekit_room,
    identity: user.id,
    name,
    canPublish: isHost,
  });
  return { ok: true, data: { url, token, canPublish: isHost } };
}

/**
 * Host: flip a LiveKit stream to "live" once the browser starts publishing.
 * Idempotent — safe to call again on reconnect.
 */
export async function goLive(streamId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: stream } = await supabase
    .from("live_streams")
    .select("id, host_id, status, started_at")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (stream.host_id !== user.id) return { ok: false, error: "Host only" };
  if (stream.status === "ended") {
    return { ok: false, error: "This broadcast has ended." };
  }
  if (stream.status === "live") return { ok: true, data: undefined };

  const { error } = await supabase
    .from("live_streams")
    .update({
      status: "live",
      started_at: stream.started_at ?? new Date().toISOString(),
    })
    .eq("id", stream.id)
    .eq("host_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/live/${streamId}`);
  return { ok: true, data: undefined };
}
