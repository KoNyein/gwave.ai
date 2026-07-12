import "server-only";

/**
 * Minimal SMS sender. Uses Twilio when its credentials are configured; returns
 * a clear "not configured" error otherwise so the operator knows to set it up.
 * Server-only — credentials never reach the client.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (a Twilio number or
 * messaging-service SID starting with "MG").
 */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
  );
}

/** Best-effort E.164 normalisation for Myanmar-style local numbers. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.replace(/[\s-]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return "+" + trimmed.slice(2);
  // Local Myanmar number "09..." → +959...
  if (trimmed.startsWith("0")) return "+95" + trimmed.slice(1);
  return "+" + trimmed;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    throw new Error("SMS provider is not configured.");
  }

  const params = new URLSearchParams({ To: normalizePhone(to), Body: body });
  // A Twilio Messaging Service SID uses MessagingServiceSid; a phone uses From.
  if (from.startsWith("MG")) params.set("MessagingServiceSid", from);
  else params.set("From", from);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SMS send failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
}
