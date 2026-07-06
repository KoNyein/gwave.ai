"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

/** Opens (or creates) the 1-1 conversation with another user. */
export async function openDirectConversation(
  otherUserId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  if (!uuid.safeParse(otherUserId).success) {
    return { ok: false, error: "Invalid user." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_or_create_direct_conversation",
    { other_user: otherUserId },
  );
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to open chat." };
  }
  return { ok: true, data: { conversationId: data } };
}

const sendMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    content: z.string().max(4000),
    imagePath: z.string().max(500).nullable(),
  })
  .refine((input) => input.content.trim().length > 0 || input.imagePath, {
    message: "Message is empty.",
  });

export async function sendMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<{ messageId: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid message." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: user.id,
      content: parsed.data.content.trim(),
      image_path: parsed.data.imagePath,
    })
    .select("id")
    .single();
  if (error || !message) {
    return { ok: false, error: error?.message ?? "Failed to send." };
  }
  return { ok: true, data: { messageId: message.id } };
}

/** Marks a conversation as read up to now (read receipt). */
export async function markConversationRead(
  conversationId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(conversationId).success) {
    return { ok: false, error: "Invalid conversation." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
