import "server-only";

import { createClient } from "@/lib/data/server";

export interface TypingSummary {
  bestWpm: number;
  attempts: number;
  avgAccuracy: number;
}

/** The caller's typing-practice summary for one language course. */
export async function getTypingSummary(
  userId: string,
  lang: string,
): Promise<TypingSummary> {
  const db = await createClient();
  const { data } = await db
    .from("typing_scores")
    .select("wpm, accuracy")
    .eq("user_id", userId)
    .eq("lang", lang)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<{ wpm: number; accuracy: number }[]>();
  const rows = data ?? [];
  const bestWpm = rows.reduce((m, r) => Math.max(m, Number(r.wpm)), 0);
  const avgAccuracy = rows.length
    ? Math.round(rows.reduce((s, r) => s + Number(r.accuracy), 0) / rows.length)
    : 0;
  return { bestWpm, attempts: rows.length, avgAccuracy };
}
