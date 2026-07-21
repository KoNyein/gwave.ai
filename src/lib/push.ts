import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@gwave.ai";

let configured = false;
function ensureConfigured(): boolean {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Fan a push notification out to every device a user has subscribed. No-op
 * when VAPID keys aren't configured (dev). Expired/invalid endpoints (404,
 * 410) are pruned. Best-effort: never throws to the caller.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          body,
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) stale.push(s.id as string);
      }
    }),
  );

  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }
}

/**
 * Convenience: push a social event to a recipient, resolving the actor's
 * display name. Skips self-notifications. Best-effort; never throws.
 */
export async function pushSocial(
  recipientId: string,
  actorId: string,
  body: (actorName: string) => string,
  url: string,
): Promise<void> {
  if (!recipientId || recipientId === actorId) return;
  try {
    const admin = createAdminClient();
    const { data: actor } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", actorId)
      .maybeSingle();
    const name =
      (actor?.full_name as string | null) ||
      (actor?.username as string | null) ||
      "Someone";
    await sendPushToUser(recipientId, {
      title: "Gwave",
      body: body(name),
      url,
    });
  } catch {
    /* best-effort */
  }
}
