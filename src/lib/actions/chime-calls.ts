"use server";

import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { getCurrentUser } from "@/lib/auth";
import {
  chimeIsCallProvider,
  createChimeMeeting,
  deleteChimeMeeting,
  joinChimeMeeting,
  type ChimeJoinInfo,
} from "@/lib/chime";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

/** The caller must actually be in the conversation they claim to be calling. */
async function inConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Caller: create the Chime meeting for a call and get this user's join info.
 * The meeting id travels to the callee through the existing supabase call
 * signaling; the callee then calls joinChimeCall.
 */
export async function startChimeCall(
  conversationId: string,
  callId: string,
): Promise<ActionResult<{ meetingId: string; join: ChimeJoinInfo }>> {
  if (!chimeIsCallProvider()) {
    return { ok: false, error: "Chime calls are not enabled." };
  }
  if (!uuid.safeParse(conversationId).success || !uuid.safeParse(callId).success) {
    return { ok: false, error: "Invalid call." };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await inConversation(user.id, conversationId))) {
    return { ok: false, error: "Not in this conversation." };
  }
  try {
    const result = await createChimeMeeting(callId, user.id);
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: "Call service is not reachable." };
  }
}

/** Callee: mint an attendee for an existing call meeting. */
export async function joinChimeCall(
  conversationId: string,
  meetingId: string,
): Promise<ActionResult<{ attendee: Record<string, unknown> }>> {
  if (!chimeIsCallProvider()) {
    return { ok: false, error: "Chime calls are not enabled." };
  }
  if (!uuid.safeParse(conversationId).success) {
    return { ok: false, error: "Invalid call." };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await inConversation(user.id, conversationId))) {
    return { ok: false, error: "Not in this conversation." };
  }
  const attendee = await joinChimeMeeting(meetingId, user.id);
  if (!attendee) return { ok: false, error: "This call has ended." };
  return { ok: true, data: { attendee } };
}

/** Either side on hangup: end the meeting (best-effort; also auto-expires). */
export async function endChimeCall(
  conversationId: string,
  meetingId: string,
): Promise<ActionResult> {
  if (!chimeIsCallProvider()) return { ok: true, data: undefined };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await inConversation(user.id, conversationId))) {
    return { ok: false, error: "Not in this conversation." };
  }
  await deleteChimeMeeting(meetingId);
  return { ok: true, data: undefined };
}
