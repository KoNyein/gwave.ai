"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { API_SCOPES, hashApiKey } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";
import type { WebhookEvent } from "@/types/database";

const uuid = z.string().uuid();

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  rateLimit: z.number().int().min(1).max(10000),
});

/**
 * Creates an API key. The full key (`gw_<prefix>_<secret>`) is returned
 * ONCE and never stored — only its SHA-256 hash.
 */
export async function createApiKey(
  input: z.infer<typeof createKeySchema>,
): Promise<ActionResult<{ fullKey: string; prefix: string }>> {
  const parsed = createKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid key settings." };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const fullKey = `gw_${prefix}_${secret}`;

  const supabase = await createClient();
  // RLS enforces developer+ on insert.
  const { error } = await supabase.from("api_keys").insert({
    owner_id: userId,
    name: parsed.data.name.trim(),
    prefix,
    key_hash: hashApiKey(fullKey),
    scopes: parsed.data.scopes,
    rate_limit: parsed.data.rateLimit,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dev");
  return { ok: true, data: { fullKey, prefix } };
}

export async function revokeApiKey(keyId: string): Promise<ActionResult> {
  if (!uuid.safeParse(keyId).success) {
    return { ok: false, error: "Invalid key." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked: true })
    .eq("id", keyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dev");
  return { ok: true, data: undefined };
}

/** Revokes the old key and issues a fresh one with the same settings. */
export async function rotateApiKey(
  keyId: string,
): Promise<ActionResult<{ fullKey: string; prefix: string }>> {
  if (!uuid.safeParse(keyId).success) {
    return { ok: false, error: "Invalid key." };
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("api_keys")
    .select("name, scopes, rate_limit")
    .eq("id", keyId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Key not found." };

  const revoke = await revokeApiKey(keyId);
  if (!revoke.ok) return revoke;

  return createApiKey({
    name: existing.name,
    scopes: existing.scopes as (typeof API_SCOPES)[number][],
    rateLimit: existing.rate_limit,
  });
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS: WebhookEvent[] = [
  "post.created",
  "sale.completed",
  "alert.triggered",
];

const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z
    .array(z.enum(["post.created", "sale.completed", "alert.triggered"]))
    .min(1),
});

/** Registers a webhook; returns the HMAC signing secret (shown once). */
export async function createWebhook(
  input: z.infer<typeof createWebhookSchema>,
): Promise<ActionResult<{ secret: string }>> {
  const parsed = createWebhookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid webhook." };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").insert({
    owner_id: userId,
    url: parsed.data.url,
    events: parsed.data.events.filter((event): event is WebhookEvent =>
      WEBHOOK_EVENTS.includes(event as WebhookEvent),
    ),
    secret,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dev/webhooks");
  return { ok: true, data: { secret } };
}

export async function setWebhookActive(
  webhookId: string,
  active: boolean,
): Promise<ActionResult> {
  if (!uuid.safeParse(webhookId).success) {
    return { ok: false, error: "Invalid webhook." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("webhooks")
    .update({ active })
    .eq("id", webhookId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dev/webhooks");
  return { ok: true, data: undefined };
}

export async function deleteWebhook(webhookId: string): Promise<ActionResult> {
  if (!uuid.safeParse(webhookId).success) {
    return { ok: false, error: "Invalid webhook." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", webhookId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dev/webhooks");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Deploy (Coolify)
// ---------------------------------------------------------------------------

/**
 * Triggers a redeploy via the Coolify API. Requires COOLIFY_API_URL,
 * COOLIFY_API_TOKEN and COOLIFY_APP_UUID env vars on the server.
 */
export async function triggerRedeploy(): Promise<ActionResult<{ message: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile ||
    !["developer", "admin", "super_admin"].includes(profile.role)
  ) {
    return { ok: false, error: "Developer access required." };
  }

  const apiUrl = process.env.COOLIFY_API_URL;
  const token = process.env.COOLIFY_API_TOKEN;
  const appUuid = process.env.COOLIFY_APP_UUID;
  if (!apiUrl || !token || !appUuid) {
    return {
      ok: false,
      error:
        "Coolify is not configured (set COOLIFY_API_URL, COOLIFY_API_TOKEN, COOLIFY_APP_UUID).",
    };
  }

  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/v1/deploy?uuid=${encodeURIComponent(appUuid)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        error: `Coolify responded ${response.status}.`,
      };
    }
    return { ok: true, data: { message: "Deployment queued." } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Deploy request failed.",
    };
  }
}
