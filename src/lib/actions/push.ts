"use server";

import { createClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/actions/posts";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/** Save (or refresh) a browser push subscription for the current user. */
export async function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<ActionResult> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: "Invalid subscription" };
  }

  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Remove a push subscription (on unsubscribe / sign-out). */
export async function deletePushSubscription(
  endpoint: string,
): Promise<ActionResult> {
  const db = await createClient();
  const { error } = await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
