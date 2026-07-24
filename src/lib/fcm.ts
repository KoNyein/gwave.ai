import "server-only";

import { createSign } from "node:crypto";

import { createAdminClient } from "@/lib/data/admin";

/**
 * Firebase Cloud Messaging (HTTP v1) — native push to the Flutter app, the
 * counterpart to the web `sendPushToUser` (VAPID). This is what makes a call
 * ring on a phone whose app is fully closed: the realtime ring inbox is dead
 * when the app isn't running, so the caller also POSTs /api/mobile/call/notify,
 * which fans a high-priority *data* message out to the callee's registered
 * device tokens; the app's background FCM handler shows the full-screen ringer.
 *
 * Fully env-gated: with no `FCM_SERVICE_ACCOUNT_JSON` configured every call is a
 * silent no-op, so this is safe to ship ahead of the Firebase project existing.
 * No extra npm dependency — the service-account JWT is signed with Node crypto
 * and exchanged for an OAuth token against Google's token endpoint.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    if (sa.client_email && sa.private_key && sa.project_id) {
      // Env stores the key with literal "\n"; restore real newlines for PEM.
      return {
        client_email: sa.client_email,
        private_key: sa.private_key.replace(/\\n/g, "\n"),
        project_id: sa.project_id,
      };
    }
  } catch {
    /* malformed JSON — treat as unconfigured */
  }
  return null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Cache the OAuth access token until shortly before it expires (default 1h).
let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  let signature: string;
  try {
    signature = base64url(
      createSign("RSA-SHA256").update(signingInput).sign(sa.private_key),
    );
  } catch {
    return null; // bad private key
  }
  const jwt = `${signingInput}.${signature}`;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) return null;
    tokenCache = {
      token: json.access_token,
      exp: now + (json.expires_in ?? 3600),
    };
    return json.access_token;
  } catch {
    return null;
  }
}

export interface FcmMessage {
  /** Data-only payload (all values must be strings). Preferred for calls so the
   *  app's background handler decides how to present it (full-screen ringer). */
  data?: Record<string, string>;
  /** Optional visible notification (title/body) for non-call pushes. */
  notification?: { title: string; body: string };
}

/** True when FCM is configured — lets callers skip work when it's a no-op. */
export function fcmConfigured(): boolean {
  return loadServiceAccount() !== null;
}

/**
 * Send an FCM message to every device a user has registered. No-op (silent)
 * when FCM isn't configured. Best-effort: never throws; prunes tokens FCM
 * reports as unregistered (app uninstalled / token rotated).
 */
export async function sendFcmToUser(
  userId: string,
  message: FcmMessage,
): Promise<void> {
  const sa = loadServiceAccount();
  if (!sa) return;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("device_tokens")
    .select("token")
    .eq("user_id", userId);
  const tokens = (rows ?? []).map((r) => (r as { token: string }).token);
  if (tokens.length === 0) return;

  const accessToken = await getAccessToken(sa);
  if (!accessToken) return;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const stale: string[] = [];

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              ...(message.data ? { data: message.data } : {}),
              ...(message.notification
                ? { notification: message.notification }
                : {}),
              // High priority + a data-only "call" wakes a doze/closed app so
              // it can ring immediately; a normal notification would be batched.
              android: {
                priority: "high",
                ...(message.notification
                  ? {}
                  : { ttl: "45s" }),
              },
            },
          }),
        });
        if (res.status === 404 || res.status === 403) {
          // 404 UNREGISTERED (token dead) / 403 SenderId mismatch → drop it.
          stale.push(token);
        }
      } catch {
        /* transient network error — keep the token, retry next call */
      }
    }),
  );

  if (stale.length > 0) {
    await admin.from("device_tokens").delete().in("token", stale);
  }
}
