"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/data/server";

const schema = z.object({
  streamId: z.string().uuid(),
  giftId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  pin: z.string().trim().regex(/^[0-9]{4,6}$/).optional().or(z.literal("")),
});

/** Send a live gift — moves G-Pay from the viewer to the host (PIN-gated). */
export async function sendLiveGift(input: {
  streamId: string;
  giftId: string;
  quantity: number;
  pin?: string;
}): Promise<ActionResult<{ eventId: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await db.rpc("send_live_gift", {
    p_stream: parsed.data.streamId,
    p_gift: parsed.data.giftId,
    p_quantity: parsed.data.quantity,
    p_pin: parsed.data.pin ? parsed.data.pin : null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/live/${parsed.data.streamId}`);
  revalidatePath("/gpay");
  return { ok: true, data: { eventId: String(data) } };
}
