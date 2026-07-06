import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NotificationWithActor } from "@/types/social";

const NOTIFICATION_SELECT = `
  *,
  actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url)
`;

export async function getNotifications(
  userId: string,
  limit = 30,
): Promise<NotificationWithActor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationWithActor[]>();

  if (error) {
    throw new Error(`Failed to load notifications: ${error.message}`);
  }
  return data ?? [];
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("read", false);
  return count ?? 0;
}
