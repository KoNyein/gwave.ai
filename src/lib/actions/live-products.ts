"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/data/server";

const pinSchema = z.object({
  streamId: z.string().uuid(),
  productId: z.string().uuid(),
});

/** Host: pin one of their products to their live stream. RLS enforces both. */
export async function pinLiveProduct(input: {
  streamId: string;
  productId: string;
}): Promise<ActionResult> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const db = await createClient();
  const { error } = await db.from("live_products").insert({
    stream_id: parsed.data.streamId,
    product_id: parsed.data.productId,
  });
  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? "That product is already pinned."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath(`/live/${parsed.data.streamId}`);
  return { ok: true, data: undefined };
}

/** Host: unpin a product from their live stream. */
export async function unpinLiveProduct(input: {
  streamId: string;
  productId: string;
}): Promise<ActionResult> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const db = await createClient();
  const { error } = await db
    .from("live_products")
    .delete()
    .eq("stream_id", parsed.data.streamId)
    .eq("product_id", parsed.data.productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/live/${parsed.data.streamId}`);
  return { ok: true, data: undefined };
}
