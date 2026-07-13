import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/types/database";
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

  // The latest message *per conversation*. This used to be one global
  // `order by created_at desc limit ids.length * 8`, which is a single window
  // across every conversation at once: one chatty thread could fill it and starve
  // all the others, and those conversations then rendered as "No messages yet"
  // with their unread dot cleared. DISTINCT ON in the database gives exactly one
  // row each, and RLS still applies (the function is security invoker).
  const ids = conversations.map((c) => c.id);
  const { data: lastMessages } = await supabase.rpc(
    "conversation_last_messages",
    { ids },
  );
  const recent = (lastMessages ?? []) as unknown as Message[];

  const latest = new Map<string, Message>();
  for (const message of recent) {
    latest.set(message.conversation_id, message);
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
