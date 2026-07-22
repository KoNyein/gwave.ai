"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { notifyNearbySos } from "@/lib/sos-notify";
import { createClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import type { SosCategory, SosStatus } from "@/types/database";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const raiseSchema = z.object({
  category: z.enum([
    "medical",
    "disaster",
    "conflict",
    "fire",
    "trapped",
    "other",
  ]),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
});

/**
 * Raise (or refresh) an SOS. A user only ever has one open alert: if one exists
 * it is updated in place with the fresh location and details, so re-tapping the
 * SOS button after moving keeps the map accurate instead of stacking alerts.
 */
export async function raiseSos(
  input: z.infer<typeof raiseSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = raiseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid SOS." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const db = await createClient();
  const { data: existing } = await db
    .from("sos_alerts")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "safe"])
    .limit(1)
    .maybeSingle();

  const fields = {
    category: parsed.data.category,
    status: "active" as const,
    message: parsed.data.message || null,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    accuracy: parsed.data.accuracy ?? null,
    updated_at: new Date().toISOString(),
    resolved_at: null,
  };

  const { data, error } = existing
    ? await db
        .from("sos_alerts")
        .update(fields)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await db
        .from("sos_alerts")
        .insert({ user_id: userId, ...fields })
        .select("id")
        .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not send SOS." };
  }

  // Alert nearby users (best-effort; never blocks the SOS). Only send on a new
  // alert, not on every location refresh of an existing one, to avoid spam.
  if (!existing) {
    const { data: me } = await db
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();
    await notifyNearbySos({
      raiserId: userId,
      raiserName: me?.full_name || me?.username || "တစ်ဦး",
      category: parsed.data.category,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });
  }

  revalidatePath("/map");
  return { ok: true, data: { id: data.id } };
}

/** Change the caller's own alert status ("safe", "resolved", "cancelled"). */
export async function setSosStatus(
  id: string,
  status: Extract<SosStatus, "safe" | "resolved" | "cancelled">,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const db = await createClient();
  const { error } = await db
    .from("sos_alerts")
    .update({
      status,
      updated_at: new Date().toISOString(),
      resolved_at:
        status === "resolved" || status === "cancelled"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/map");
  return { ok: true, data: undefined };
}

/** Mark yourself as responding to someone's SOS (idempotent). */
export async function respondToSos(
  alertId: string,
  note?: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const db = await createClient();
  const { error } = await db.from("sos_responders").upsert(
    {
      alert_id: alertId,
      user_id: userId,
      note: note?.trim().slice(0, 300) || null,
    },
    { onConflict: "alert_id,user_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/map");
  return { ok: true, data: undefined };
}

/** Withdraw your response to an SOS. */
export async function withdrawSosResponse(
  alertId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const db = await createClient();
  const { error } = await db
    .from("sos_responders")
    .delete()
    .eq("alert_id", alertId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/map");
  return { ok: true, data: undefined };
}

export type { SosCategory };
