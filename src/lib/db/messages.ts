import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ConversationSummary,
  MessageWithSender,
} from "@/types/social";

const PARTICIPANT_SELECT = `
  user_id,
  last_read_at,
  profile:profiles!conversation_participants_user_id_fkey(id, username, full_name, avatar_url)
`;

/** Conversations for the messenger sidebar, most recent first. */
export async function getConversations(
  userId: string,
): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(`*, participants:conversation_participants(${PARTICIPANT_SELECT})`)
    .order("last_message_at", { ascending: false })
    .limit(50)
    .returns<Omit<ConversationSummary, "last_message" | "unread">[]>();
  if (error) {
    throw new Error(`Failed to load conversations: ${error.message}`);
  }

  const conversations = data ?? [];
  if (conversations.length === 0) return [];

  // Latest message per conversation (one query; grouped client-side).
  const ids = conversations.map((c) => c.id);
  const { data: recent } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, content, image_path, latitude, created_at",
    )
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(ids.length * 8);

  const latest = new Map<
    string,
    NonNullable<typeof recent>[number]
  >();
  for (const message of recent ?? []) {
    if (!latest.has(message.conversation_id)) {
      latest.set(message.conversation_id, message);
    }
  }

  return conversations.map((conversation) => {
    const last = latest.get(conversation.id) ?? null;
    const me = conversation.participants.find((p) => p.user_id === userId);
    const unread =
      last !== null &&
      last.sender_id !== userId &&
      me !== undefined &&
      new Date(last.created_at) > new Date(me.last_read_at);
    return { ...conversation, last_message: last, unread };
  });
}

/** Messages in a conversation, oldest first (last `limit`). */
export async function getMessages(
  conversationId: string,
  limit = 100,
): Promise<MessageWithSender[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "*, sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<MessageWithSender[]>();
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data ?? []).reverse();
}

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationSummary | null> {
  const conversations = await getConversations(userId);
  return conversations.find((c) => c.id === conversationId) ?? null;
}
