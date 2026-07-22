"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/data/server";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["bluetooth", "wifi", "nfc", "airtag", "other"]),
  identifier: z.string().trim().max(200).optional(),
});

/** Register a new physical tracker (Bluetooth/Wi-Fi/NFC/AirTag). */
export async function createTracker(input: {
  name: string;
  type: string;
  identifier?: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { data, error } = await db
    .from("trackers")
    .insert({
      owner_id: userId,
      name: parsed.data.name,
      type: parsed.data.type,
      identifier: parsed.data.identifier || null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save tracker" };
  }
  revalidatePath("/family/trackers");
  return { ok: true, data: { id: data.id } };
}

const locationSchema = z.object({
  id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  battery: z.number().int().min(0).max(100).optional(),
});

/** Record a tracker's latest position (e.g. the phone's location near it). */
export async function updateTrackerLocation(input: {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  battery?: number;
}): Promise<ActionResult<null>> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db
    .from("trackers")
    .update({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      battery: parsed.data.battery ?? null,
      last_seen: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/family/trackers");
  return { ok: true, data: null };
}

/** Remove a tracker the caller owns. */
export async function deleteTracker(id: string): Promise<ActionResult<null>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const db = await createClient();
  const { error } = await db
    .from("trackers")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/family/trackers");
  return { ok: true, data: null };
}
