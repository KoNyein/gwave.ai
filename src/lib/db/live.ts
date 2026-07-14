import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LiveStream } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface LiveStreamWithHost extends LiveStream {
  host: AuthorSummary;
  /** Game-stream extras (nullable; added by the live_game_goal migration). */
  game_name?: string | null;
  goal_amount?: number | null;
  goal_label?: string | null;
}

const HOST_SELECT =
  "*, host:profiles!live_streams_host_id_fkey(id, username, full_name, avatar_url)";

/** Live broadcasts first, then the most recent past streams. */
/**
 * Streams for the /live index: everything still broadcasting, then the past ones.
 *
 * A row only leaves `status='live'` when the host ends it or the LiveKit webhook
 * fires. If both miss — webhook misconfigured, delivery dropped — the row would
 * sit at the top of the page under a pulsing LIVE badge forever, sending viewers
 * into an empty room. So anything still "live" after this long is treated as a
 * past broadcast in the UI regardless of its status column.
 */
const STALE_LIVE_HOURS = 12;

export async function listStreams(limit = 30): Promise<LiveStreamWithHost[]> {
  const supabase = await createClient();
  const staleCutoff = new Date(
    Date.now() - STALE_LIVE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const [liveRes, pastRes] = await Promise.all([
    supabase
      .from("live_streams")
      .select(HOST_SELECT)
      .eq("status", "live")
      .gte("started_at", staleCutoff)
      .order("started_at", { ascending: false })
      .limit(limit)
      .returns<LiveStreamWithHost[]>(),
    supabase
      .from("live_streams")
      .select(HOST_SELECT)
      .or(`status.neq.live,started_at.lt.${staleCutoff}`)
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

export interface HostStreamStat {
  stream: LiveStream;
  reactions: number;
  messages: number;
  durationMinutes: number | null;
}

export interface HostDashboard {
  totalStreams: number;
  liveNow: number;
  totalReactions: number;
  totalMessages: number;
  peakViewers: number;
  streams: HostStreamStat[];
}

/** Per-stream engagement for the streamer's own dashboard. */
export async function getHostDashboard(
  hostId: string,
  limit = 30,
): Promise<HostDashboard> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_streams")
    .select("*")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LiveStream[]>();
  const streams = data ?? [];

  const stats = await Promise.all(
    streams.map(async (stream) => {
      const [reactRes, chatRes] = await Promise.all([
        supabase
          .from("live_reactions")
          .select("id", { count: "exact", head: true })
          .eq("stream_id", stream.id),
        supabase
          .from("live_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("stream_id", stream.id),
      ]);
      let durationMinutes: number | null = null;
      if (stream.started_at && stream.ended_at) {
        durationMinutes = Math.max(
          0,
          Math.round(
            (new Date(stream.ended_at).getTime() -
              new Date(stream.started_at).getTime()) /
              60000,
          ),
        );
      }
      return {
        stream,
        reactions: reactRes.count ?? 0,
        messages: chatRes.count ?? 0,
        durationMinutes,
      };
    }),
  );

  return {
    totalStreams: streams.length,
    liveNow: streams.filter((s) => s.status === "live").length,
    totalReactions: stats.reduce((sum, s) => sum + s.reactions, 0),
    totalMessages: stats.reduce((sum, s) => sum + s.messages, 0),
    peakViewers: streams.reduce((max, s) => Math.max(max, s.viewer_count), 0),
    streams: stats,
  };
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
