"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

const rateSchema = z.object({
  code: z.enum(["USD", "THB", "MMK"]),
  ratePerUsd: z.number().positive().max(1_000_000),
});

/** Admin: update a currency rate in the manual table (RLS enforces admin). */
export async function updateCurrencyRate(
  input: z.infer<typeof rateSchema>,
): Promise<ActionResult> {
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid rate." };
  if (parsed.data.code === "USD" && parsed.data.ratePerUsd !== 1) {
    return { ok: false, error: "USD is the base currency (rate 1)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("currency_rates")
    .update({ rate_per_usd: parsed.data.ratePerUsd })
    .eq("code", parsed.data.code);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tools/currency");
  return { ok: true, data: undefined };
}
