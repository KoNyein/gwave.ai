"use server";

import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

const startSchema = z.object({
  conversationId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullish(),
  minutes: z.union([z.literal(15), z.literal(60), z.literal(480)]),
});

/**
 * Begin sharing live location: one message (carrying the starting pin and the
 * expiry, so the bubble renders immediately) plus the live_locations row the
 * sender will keep overwriting.
 */
export async function startLiveLocation(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult<{ messageId: string; expiresAt: string }>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid location." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const expiresAt = new Date(
    Date.now() + parsed.data.minutes * 60 * 1000,
  ).toISOString();

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: user.id,
      content: "",
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      live_until: expiresAt,
    })
    .select("id")
    .single();
  if (messageError || !message) {
    return { ok: false, error: messageError?.message ?? "Failed to share." };
  }

  const { error } = await supabase.from("live_locations").insert({
    message_id: message.id,
    conversation_id: parsed.data.conversationId,
    user_id: user.id,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    accuracy: parsed.data.accuracy ?? null,
    expires_at: expiresAt,
  });
  if (error) {
    // Don't leave a message claiming to be live with nothing behind it.
    await supabase.from("messages").delete().eq("id", message.id);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { messageId: message.id, expiresAt } };
}

const moveSchema = z.object({
  messageId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullish(),
});

/**
 * Move the pin. RLS already limits this to the sharer's own row; the filters
 * here stop a stale browser tab from resurrecting a share that has expired or
 * that the user has already stopped.
 */
export async function moveLiveLocation(
  input: z.infer<typeof moveSchema>,
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid location." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("live_locations")
    .update({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("message_id", parsed.data.messageId)
    .is("stopped_at", null)
    .gt("expires_at", new Date().toISOString());
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Stop sharing early. The message stays, showing the last known position. */
export async function stopLiveLocation(
  messageId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("live_locations")
    .update({ stopped_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .is("stopped_at", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
