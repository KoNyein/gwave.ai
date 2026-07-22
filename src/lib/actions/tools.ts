"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/data/server";
import type { ActionResult } from "@/lib/actions/posts";

const rateSchema = z.object({
  // Any ISO-4217 fiat or crypto ticker (3–6 uppercase letters); RLS still
  // limits writes to admins and the row must already exist.
  code: z.string().regex(/^[A-Z]{3,6}$/),
  ratePerUsd: z.number().positive().max(100_000_000),
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
  // The G-Pay peg is fixed: 1 G-Pay = 1 MMK. MMK's USD rate may move, but it
  // must stay a positive number — the peg itself is enforced in code, not here.

  const db = await createClient();
  const { error } = await db
    .from("currency_rates")
    .update({ rate_per_usd: parsed.data.ratePerUsd })
    .eq("code", parsed.data.code);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tools/currency");
  return { ok: true, data: undefined };
}
