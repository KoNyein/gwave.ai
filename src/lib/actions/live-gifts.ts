"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase.rpc("send_live_gift", {
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
