"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

import { notifyConversation } from "@/lib/notify-conversation";
import { createClient } from "@/lib/data/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

/** Opens (or creates) the 1-1 conversation with another user. */
export async function openDirectConversation(
  otherUserId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  if (!uuid.safeParse(otherUserId).success) {
    return { ok: false, error: "Invalid user." };
  }
  const db = await createClient();
  const { data, error } = await db.rpc(
    "get_or_create_direct_conversation",
    { other_user: otherUserId },
  );
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to open chat." };
  }
  return { ok: true, data: { conversationId: data } };
}

/**
 * Start a group chat. Goes through the `create_group_conversation` RPC because
 * the conversation row and its membership rows are two inserts, and RLS only
 * admits an existing participant — doing it client-side locks the creator out
 * between the two statements.
 */
export async function createGroupConversation(
  title: string,
  memberIds: string[],
): Promise<ActionResult<{ conversationId: string }>> {
  const clean = title.trim();
  if (!clean) return { ok: false, error: "Name the group first." };
  if (clean.length > 80) return { ok: false, error: "That name is too long." };
  const ids = Array.from(new Set(memberIds)).filter(
    (id) => uuid.safeParse(id).success,
  );
  if (ids.length === 0) return { ok: false, error: "Pick at least one friend." };

  const db = await createClient();
  const { data, error } = await db.rpc("create_group_conversation", {
    group_title: clean,
    members: ids,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create the group." };
  }
  return { ok: true, data: { conversationId: data as string } };
}

/** Invite more people into a group. Returns how many were actually added. */
export async function addGroupMembers(
  conversationId: string,
  memberIds: string[],
): Promise<ActionResult<{ added: number }>> {
  if (!uuid.safeParse(conversationId).success) {
    return { ok: false, error: "Invalid conversation." };
  }
  const ids = Array.from(new Set(memberIds)).filter(
    (id) => uuid.safeParse(id).success,
  );
  if (ids.length === 0) return { ok: false, error: "Pick someone to add." };

  const db = await createClient();
  const { data, error } = await db.rpc("add_group_members", {
    conversation: conversationId,
    members: ids,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { added: Number(data ?? 0) } };
}

/** Leave a group; the server deletes it once the last member is gone. */
export async function leaveGroupConversation(
  conversationId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(conversationId).success) {
    return { ok: false, error: "Invalid conversation." };
  }
  const db = await createClient();
  const { error } = await db.rpc("leave_group_conversation", {
    conversation: conversationId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

const sendMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    content: z.string().max(4000),
    imagePath: z.string().max(500).nullable(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    filePath: z.string().max(500).nullish(),
    fileKind: z.enum(["video", "file", "audio"]).nullish(),
    fileName: z.string().max(200).nullish(),
    // Voice notes only: how long the clip runs. The DB enforces the same pairing.
    durationSeconds: z.number().int().min(1).max(600).nullish(),
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
  })
  .refine(
    (input) => (input.fileKind === "audio") === (input.durationSeconds != null),
    { message: "A voice message needs a duration, and only a voice message." },
  );

/** What a wordless message reads as in a push notification. */
function previewFor(input: z.infer<typeof sendMessageSchema>): string {
  if (input.imagePath) return "📷 ဓာတ်ပုံ";
  if (input.fileKind === "audio") return "🎤 အသံ မက်ဆေ့ခ်ျ";
  if (input.fileKind === "video") return "🎥 ဗီဒီယို";
  if (input.latitude != null) return "📍 တည်နေရာ";
  return "📎 ဖိုင်";
}

export async function sendMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<{ messageId: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid message." };

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: message, error } = await db
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
      duration_seconds: parsed.data.durationSeconds ?? null,
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
    parsed.data.content.trim() || previewFor(parsed.data),
  );

  return { ok: true, data: { messageId: message.id } };
}

/** Marks a conversation as read up to now (read receipt). */
export async function markConversationRead(
  conversationId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(conversationId).success) {
    return { ok: false, error: "Invalid conversation." };
  }
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await db
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
