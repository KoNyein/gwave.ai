import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PttChannel, PttMessage } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface PttChannelWithCount extends PttChannel {
  member_count: number;
}

/** Channels the caller belongs to (owner rows included via membership). */
export async function getMyPttChannels(
  userId: string,
): Promise<PttChannelWithCount[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("ptt_channel_members")
    .select("channel:ptt_channels(*)")
    .eq("user_id", userId)
    .returns<{ channel: PttChannel | null }[]>();

  const channels = (memberships ?? [])
    .map((m) => m.channel)
    .filter((c): c is PttChannel => Boolean(c));
  if (channels.length === 0) return [];

  const { data: counts } = await supabase
    .from("ptt_channel_members")
    .select("channel_id")
    .in(
      "channel_id",
      channels.map((c) => c.id),
    )
    .returns<{ channel_id: string }[]>();
  const byChannel = new Map<string, number>();
  for (const r of counts ?? []) {
    byChannel.set(r.channel_id, (byChannel.get(r.channel_id) ?? 0) + 1);
  }

  return channels
    .map((c) => ({ ...c, member_count: byChannel.get(c.id) ?? 1 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One channel the caller can access, or null. */
export async function getPttChannel(
  channelId: string,
): Promise<PttChannel | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ptt_channels")
    .select("*")
    .eq("id", channelId)
    .maybeSingle();
  return data;
}

export interface PttMessageWithPerson extends PttMessage {
  person: AuthorSummary;
}

/** Recent voice messages on a channel, oldest→newest for playback order. */
export async function getPttMessages(
  channelId: string,
  limit = 50,
): Promise<PttMessageWithPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ptt_messages")
    .select(
      "*, person:profiles!ptt_messages_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PttMessageWithPerson[]>();
  return (data ?? []).reverse();
}
