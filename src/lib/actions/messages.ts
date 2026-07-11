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
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    filePath: z.string().max(500).nullish(),
    fileKind: z.enum(["video", "file"]).nullish(),
    fileName: z.string().max(200).nullish(),
  })
  .refine(
    (input) =>
      input.content.trim().length > 0 ||
      input.imagePath ||
      input.filePath ||
      (input.latitude != null && input.longitude != null),
    { message: "Message is empty." },
  )
  .refine((input) => (input.latitude == null) === (input.longitude == null), {
    message: "Location needs both coordinates.",
  })
  .refine((input) => (input.filePath == null) === (input.fileKind == null), {
    message: "Attachment needs a kind.",
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
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      file_path: parsed.data.filePath ?? null,
      file_kind: parsed.data.fileKind ?? null,
      file_name: parsed.data.fileName ?? null,
    })
    .select("id")
    .single();
  if (error || !message) {
    return { ok: false, error: error?.message ?? "Failed to send." };
  }

  // Push the other participants (best-effort, non-blocking on failure).
  void notifyConversation(
    parsed.data.conversationId,
    user.id,
    parsed.data.content.trim() || (parsed.data.imagePath ? "📷 ဓာတ်ပုံ" : "📎 ဖိုင်"),
  );

  return { ok: true, data: { messageId: message.id } };
}

/** Web-push the peers of a conversation about a new message. */
async function notifyConversation(
  conversationId: string,
  senderId: string,
  preview: string,
): Promise<void> {
  try {
    const { sendPushToUser } = await import("@/lib/push");
    const supabase = await createClient();
    const [{ data: parts }, { data: sender }] = await Promise.all([
      supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId),
      supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", senderId)
        .maybeSingle(),
    ]);
    const name =
      (sender?.full_name as string | null) ||
      (sender?.username as string | null) ||
      "Someone";
    const recipients = (parts ?? [])
      .map((p) => p.user_id as string)
      .filter((id) => id !== senderId);
    await Promise.all(
      recipients.map((id) =>
        sendPushToUser(id, {
          title: name,
          body: preview.slice(0, 120),
          url: "/messages",
          tag: `msg:${conversationId}`,
        }),
      ),
    );
  } catch {
    /* push is best-effort */
  }
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
