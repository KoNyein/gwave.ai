"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/data/server";
import type { FamilyCircle } from "@/types/database";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/** Create a new family circle (the caller becomes its first member). */
export async function createFamilyCircle(
  name: string,
): Promise<ActionResult<{ id: string; inviteCode: string }>> {
  const parsed = z.string().trim().min(1).max(80).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Enter a circle name." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { data, error } = await db.rpc("create_family_circle", {
    p_name: parsed.data,
  });
  // The RPC returns the new family_circles row (a single object, though the
  // generated client types SETOF-style results loosely).
  const row = (Array.isArray(data) ? data[0] : data) as FamilyCircle | null;
  if (error || !row) {
    return { ok: false, error: error?.message ?? "Could not create circle." };
  }
  revalidatePath("/family");
  return { ok: true, data: { id: row.id, inviteCode: row.invite_code } };
}

/** Join an existing circle by invite code. */
export async function joinFamilyCircle(
  code: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = z.string().trim().min(4).max(16).safeParse(code);
  if (!parsed.success) return { ok: false, error: "Enter a valid code." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { data, error } = await db.rpc("join_family_circle", {
    p_code: parsed.data,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not join." };
  }
  revalidatePath("/family");
  return { ok: true, data: { id: data as string } };
}

const sharingSchema = z.object({
  circleId: z.string().uuid(),
  enabled: z.boolean(),
});

/** Turn location sharing on/off for one of the caller's circles. */
export async function setFamilySharing(input: {
  circleId: string;
  enabled: boolean;
}): Promise<ActionResult> {
  const parsed = sharingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db
    .from("family_memberships")
    .update({ sharing_enabled: parsed.data.enabled })
    .eq("circle_id", parsed.data.circleId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/family");
  return { ok: true, data: undefined };
}

/** Leave a circle. */
export async function leaveFamilyCircle(
  circleId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(circleId).success) {
    return { ok: false, error: "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db
    .from("family_memberships")
    .delete()
    .eq("circle_id", circleId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/family");
  return { ok: true, data: undefined };
}

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullish(),
});

/** Publish the caller's latest position (upsert). Called periodically by the
 *  client while sharing is on. */
export async function updateMyLocation(input: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): Promise<ActionResult> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid location" };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db.from("member_locations").upsert(
    {
      user_id: userId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
