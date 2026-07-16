"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(notificationId).success) {
    return { ok: false, error: "Invalid notification." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", user.id)
    .eq("read", false);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true, data: undefined };
}
