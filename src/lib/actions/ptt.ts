"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/** Short, unambiguous join code (no easily-confused characters). */
function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Create a channel and join it as the owner. */
export async function createPttChannel(
  name: string,
): Promise<ActionResult<{ id: string; joinCode: string }>> {
  const parsed = z.string().trim().min(1).max(80).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Enter a channel name." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const db = await createClient();
  const joinCode = makeJoinCode();
  const { data, error } = await db
    .from("ptt_channels")
    .insert({ name: parsed.data, join_code: joinCode, owner_id: userId })
    .select("id, join_code")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create channel." };
  }
  // Owner joins their own channel. If this fails it must not be swallowed: the
  // message RLS gates posting on is_ptt_member() with no owner exemption, so a
  // channel whose owner isn't a member is dead — the owner can hand out the join
  // code but nobody, including them, can post. Roll the channel back and report
  // the failure rather than leaving that orphan behind.
  const { error: joinError } = await db
    .from("ptt_channel_members")
    .insert({ channel_id: data.id, user_id: userId });
  if (joinError) {
    await db.from("ptt_channels").delete().eq("id", data.id);
    return { ok: false, error: "Could not create channel." };
  }

  revalidatePath("/talk");
  return { ok: true, data: { id: data.id, joinCode: data.join_code } };
}

/**
 * Join a channel by its code. Uses the service role to resolve the code, since
 * a non-member can't yet see the channel row under RLS.
 */
export async function joinPttChannel(
  code: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .string()
    .trim()
    .toUpperCase()
    .min(4)
    .max(12)
    .safeParse(code);
  if (!parsed.success) return { ok: false, error: "Enter a valid code." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: channel } = await admin
    .from("ptt_channels")
    .select("id")
    .eq("join_code", parsed.data)
    .maybeSingle();
  if (!channel) return { ok: false, error: "Channel not found." };

  const { error } = await admin
    .from("ptt_channel_members")
    .upsert(
      { channel_id: channel.id, user_id: userId },
      { onConflict: "channel_id,user_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/talk");
  return { ok: true, data: { id: channel.id } };
}

/** Post a recorded voice message to a channel (already uploaded to storage). */
export async function sendPttMessage(input: {
  channelId: string;
  audioPath: string;
  durationMs: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({
      channelId: z.string().uuid(),
      audioPath: z.string().min(1).max(300),
      durationMs: z.number().int().nonnegative().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid message." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const db = await createClient();
  const { data, error } = await db
    .from("ptt_messages")
    .insert({
      channel_id: parsed.data.channelId,
      user_id: userId,
      audio_path: parsed.data.audioPath,
      duration_ms: parsed.data.durationMs,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not send." };
  }
  return { ok: true, data: { id: data.id } };
}

/** Leave a channel. */
export async function leavePttChannel(
  channelId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const db = await createClient();
  const { error } = await db
    .from("ptt_channel_members")
    .delete()
    .eq("channel_id", channelId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/talk");
  return { ok: true, data: undefined };
}
