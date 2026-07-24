import "server-only";

import crypto from "node:crypto";

/**
 * Fire an event to the n8n automation webhook. Best-effort: if `N8N_WEBHOOK_URL`
 * isn't configured (or n8n is down), it returns false and never throws — the
 * caller has already persisted the system-of-record row. When `N8N_WEBHOOK_SECRET`
 * is set, the raw body is HMAC-signed (`X-Gwave-Signature`) so the n8n workflow
 * can verify authenticity before acting.
 */
export async function postToN8n(
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return false;
  const body = JSON.stringify({
    event,
    at: new Date().toISOString(),
    payload,
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    headers["X-Gwave-Signature"] = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
