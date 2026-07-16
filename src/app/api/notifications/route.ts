import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";

/** GET /api/notifications — recent notifications + unread count. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id, 15),
      getUnreadNotificationCount(user.id),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
