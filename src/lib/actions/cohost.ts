"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

/** Readable, unguessable-enough room code. */
function newRoomCode(): string {
  const a = "bcdfghjklmnpqrstvwxyz";
  const pick = () => a[Math.floor(Math.random() * a.length)];
  const digits = () => Math.floor(Math.random() * 10);
  return (
    Array.from({ length: 3 }, pick).join("") +
    "-" +
    Array.from({ length: 4 }, digits).join("")
  );
}

const titleSchema = z.string().trim().min(1).max(120);

/** Open a co-host Live room and add it to the public directory. */
export async function createCohostRoom(
  title: string,
): Promise<ActionResult<{ code: string }>> {
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) {
    return { ok: false, error: "Enter a room title." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const code = newRoomCode();
  const { error } = await supabase.from("cohost_rooms").insert({
    code,
    host_id: user.id,
    title: parsed.data,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/live/cohost");
  return { ok: true, data: { code } };
}

/** Host: end a co-host room (removes it from the live directory). */
export async function endCohostRoom(code: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("cohost_rooms")
    .update({ ended_at: new Date().toISOString() })
    .eq("code", code)
    .eq("host_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/live/cohost");
  return { ok: true, data: undefined };
}
