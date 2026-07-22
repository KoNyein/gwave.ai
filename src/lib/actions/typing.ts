"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/data/server";

const schema = z.object({
  lang: z.string().trim().min(1).max(20),
  wpm: z.number().int().min(0).max(400),
  accuracy: z.number().min(0).max(100),
  chars: z.number().int().min(0).max(10000),
});

/** Save one completed typing exercise (WPM + accuracy) for the current user. */
export async function recordTypingScore(
  input: z.input<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid score." };
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await db.from("typing_scores").insert({
    user_id: user.id,
    lang: parsed.data.lang,
    wpm: parsed.data.wpm,
    accuracy: parsed.data.accuracy,
    chars: parsed.data.chars,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
