"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/posts";
import { getCurrentUser } from "@/lib/auth";
import { publicEnv, isTerraEnabled } from "@/lib/env";
import {
  deauthenticateUser,
  generateWidgetSession,
} from "@/lib/health/terra";
import { createClient } from "@/lib/supabase/server";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Begin connecting a wearable: returns the Terra widget URL for the browser to
 * open. The user picks their provider and logs in there; Terra then confirms via
 * the `auth` webhook, which creates the connection row.
 */
export async function connectHealthProvider(): Promise<
  ActionResult<{ url: string }>
> {
  if (!isTerraEnabled()) {
    return { ok: false, error: "Health sync is not enabled yet." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const session = await generateWidgetSession(
    userId,
    publicEnv.NEXT_PUBLIC_SITE_URL,
  );
  if (!session) {
    return { ok: false, error: "Could not start the connection." };
  }
  return { ok: true, data: { url: session.url } };
}

/** Disconnect a device: revoke at Terra, then remove the connection row. */
export async function disconnectHealthDevice(
  connectionId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  // Owner-scoped read (RLS) to get the Terra id before deleting.
  const { data } = await supabase
    .from("health_connections" as never)
    .select("terra_user_id")
    .eq("id", connectionId)
    .maybeSingle<{ terra_user_id: string }>();

  if (data?.terra_user_id) {
    await deauthenticateUser(data.terra_user_id);
  }

  const { error } = await supabase
    .from("health_connections" as never)
    .delete()
    .eq("id", connectionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/health");
  return { ok: true, data: undefined };
}
