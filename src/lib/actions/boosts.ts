"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";
import type { BoostDailyStat } from "@/types/database";

const createSchema = z.object({
  target_type: z.enum(["post", "shop_product", "pos_product"]),
  target_id: z.string().uuid(),
  headline: z.string().trim().max(160).nullish(),
  budget_mmk: z.number().min(100).max(10_000_000),
  daily_cap_mmk: z.number().min(50),
  bid_mmk: z.number().min(1).max(100_000),
  days: z.number().int().min(1).max(90),
  audience: z
    .object({
      adult: z.boolean().optional(),
      region: z.string().max(80).nullish(),
      tags: z.array(z.string().max(40)).max(20).optional(),
    })
    .optional(),
});

/** Create a boost — escrows the budget from the caller's G-Pay wallet. */
export async function createBoost(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<string>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the boost details." };
  }
  const d = parsed.data;
  if (d.daily_cap_mmk > d.budget_mmk) {
    return { ok: false, error: "Daily cap can't exceed the total budget." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_boost", {
    p_target_type: d.target_type,
    p_target_id: d.target_id,
    p_headline: d.headline ?? null,
    p_budget_mmk: d.budget_mmk,
    p_daily_cap_mmk: d.daily_cap_mmk,
    p_bid_mmk: d.bid_mmk,
    p_days: d.days,
    p_audience: d.audience ?? {},
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/boost");
  revalidatePath("/gpay");
  return { ok: true, data: String(data) };
}

/** Record a sponsored-card impression (billed once per viewer/day server-side). */
export async function recordBoostImpression(boostId: string): Promise<void> {
  if (!boostId) return;
  const supabase = await createClient();
  await supabase.rpc("record_boost_impression", { p_boost: boostId });
}

/** Record a sponsored-card click (free engagement signal). */
export async function recordBoostClick(boostId: string): Promise<void> {
  if (!boostId) return;
  const supabase = await createClient();
  await supabase.rpc("record_boost_click", { p_boost: boostId });
}

/** Pause or resume one of the caller's campaigns. */
export async function setBoostStatus(
  boostId: string,
  status: "active" | "paused",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_boost_status", {
    p_boost: boostId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/boost");
  return { ok: true, data: undefined };
}

/** Per-day performance of one of the caller's campaigns (owner analytics). */
export async function fetchBoostDailyStats(
  boostId: string,
  days = 30,
): Promise<BoostDailyStat[]> {
  if (!boostId) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("boost_daily_stats", {
    p_boost: boostId,
    p_days: days,
  });
  return ((data as BoostDailyStat[] | null) ?? []).map((r) => ({
    day: String(r.day),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spent: Number(r.spent ?? 0),
  }));
}

/** Cancel a campaign; refunds the unspent budget to G-Pay. Returns the refund. */
export async function cancelBoost(
  boostId: string,
): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_boost", {
    p_boost: boostId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/boost");
  revalidatePath("/gpay");
  return { ok: true, data: Number(data ?? 0) };
}
