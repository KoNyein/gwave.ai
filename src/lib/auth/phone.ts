import "server-only";

import crypto from "node:crypto";

import { authEnv } from "@/lib/env";

/**
 * Phone sign-in uses Cognito's normal SignUp + SMS confirmation, so the account
 * still needs a password even though the user only ever proves ownership with an
 * OTP. We derive that password deterministically from the phone number, so both
 * sign-up and every later sign-in can recompute it without ever storing or
 * showing it. It is an HMAC (keyed by the Cognito client secret the server
 * already holds) plus a fixed prefix that guarantees the pool's password policy
 * (upper, lower, digit, symbol, length).
 */
export function derivePhonePassword(phone: string): string {
  const h = crypto
    .createHmac("sha256", authEnv.cognito.clientSecret)
    .update(`gw-phone:${phone}`)
    .digest("hex");
  return `Gw1!${h.slice(0, 28)}`;
}

/**
 * Normalise a user-typed number to E.164. Bare local numbers are assumed to be
 * Myanmar (+95): a leading 0 is dropped and +95 prepended. Returns null when the
 * result isn't a plausible E.164 number.
 */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s\-()]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) {
    if (s.startsWith("0")) s = s.slice(1);
    s = `+95${s}`;
  }
  return /^\+\d{7,15}$/.test(s) ? s : null;
}
