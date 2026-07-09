import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LiveStream } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface LiveStreamWithHost extends LiveStream {
  host: AuthorSummary;
}

const HOST_SELECT =
  "*, host:profiles!live_streams_host_id_fkey(id, username, full_name, avatar_url)";

/** Live broadcasts first, then the most recent past streams. */
export async function listStreams(limit = 30): Promise<LiveStreamWithHost[]> {
  const supabase = await createClient();
  const [liveRes, pastRes] = await Promise.all([
    supabase
      .from("live_streams")
      .select(HOST_SELECT)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(limit)
      .returns<LiveStreamWithHost[]>(),
    supabase
      .from("live_streams")
      .select(HOST_SELECT)
      .neq("status", "live")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<LiveStreamWithHost[]>(),
  ]);
  return [...(liveRes.data ?? []), ...(pastRes.data ?? [])];
}

export async function getStream(
  id: string,
): Promise<LiveStreamWithHost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_streams")
    .select(HOST_SELECT)
    .eq("id", id)
    .maybeSingle<LiveStreamWithHost>();
  return data;
}

/**
 * The RTMP stream key — RLS only returns a row when the caller hosts the
 * stream, so this is null for everyone else by construction.
 */
export async function getStreamKey(streamId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_stream_keys")
    .select("stream_key")
    .eq("stream_id", streamId)
    .maybeSingle();
  return data?.stream_key ?? null;
}

/** Recent chat history for first paint (realtime takes over after). */
export async function getRecentChat(streamId: string, limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_chat_messages")
    .select(
      "*, author:profiles!live_chat_messages_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

/** Live classes for /learn/live: live now first, then upcoming, then past. */
export async function listClasses(limit = 40): Promise<LiveStreamWithHost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_streams")
    .select(HOST_SELECT)
    .eq("kind", "class")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LiveStreamWithHost[]>();
  const classes = data ?? [];
  const rank = (s: LiveStreamWithHost) =>
    s.status === "live" ? 0 : s.status === "idle" ? 1 : 2;
  return classes.sort((a, b) => rank(a) - rank(b));
}
