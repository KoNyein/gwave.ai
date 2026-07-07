// Webhook delivery worker: sends due webhook_deliveries with an HMAC-SHA256
// signature and exponential-backoff retries (up to 5 attempts).
//
// Deploy:   supabase functions deploy deliver-webhooks
// Schedule: supabase functions schedule create deliver-webhooks --cron "* * * * *"
//
// Receivers verify the `X-Gwave-Signature: sha256=<hex>` header by HMAC'ing
// the raw request body with the webhook's secret.

// @ts-expect-error -- Deno remote import, resolved at deploy time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const MAX_ATTEMPTS = 5;

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: due, error } = await supabase
    .from("webhook_deliveries")
    .select("id, event, payload, attempts, webhook:webhooks(id, url, secret, active)")
    .is("delivered_at", null)
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .limit(25);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;

  for (const delivery of due ?? []) {
    const webhook = delivery.webhook as {
      url: string;
      secret: string;
      active: boolean;
    } | null;
    const attempts = delivery.attempts + 1;

    if (!webhook || !webhook.active) {
      await supabase
        .from("webhook_deliveries")
        .update({ attempts: MAX_ATTEMPTS, last_status: 0 })
        .eq("id", delivery.id);
      continue;
    }

    const body = JSON.stringify(delivery.payload);
    const signature = await hmacHex(webhook.secret, body);
    let status = 0;
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gwave-Event": delivery.event,
          "X-Gwave-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = response.status;
    } catch {
      status = 0;
    }

    if (status >= 200 && status < 300) {
      sent += 1;
      await supabase
        .from("webhook_deliveries")
        .update({
          attempts,
          last_status: status,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
    } else {
      failed += 1;
      // Backoff: 1, 4, 9, 16 minutes.
      const next = new Date(Date.now() + attempts * attempts * 60_000);
      await supabase
        .from("webhook_deliveries")
        .update({
          attempts,
          last_status: status,
          next_attempt_at: next.toISOString(),
        })
        .eq("id", delivery.id);
    }
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
