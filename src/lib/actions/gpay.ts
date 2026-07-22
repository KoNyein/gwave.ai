"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { sendSms, smsConfigured } from "@/lib/sms";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/data/server";
import type { GpayStatus } from "@/types/database";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

// KYC: legal name, NRC, KPay number, email, address and at least one messenger
// handle (Telegram or Viber). Only when this is complete can an account be
// created — and it still needs admin approval before it can move money.
const kycSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    nrcNumber: z.string().trim().min(4).max(40),
    phone: z
      .string()
      .trim()
      .min(5)
      .max(20)
      .regex(/^[0-9+\-\s]+$/, "Enter a valid phone number."),
    email: z.string().trim().email().max(160),
    telegram: z.string().trim().max(80).optional().or(z.literal("")),
    viber: z.string().trim().max(40).optional().or(z.literal("")),
    address: z.string().trim().min(3).max(300),
    // Storage path of the uploaded KPay payment slip (optional on edit).
    slipPath: z.string().trim().max(500).optional().or(z.literal("")),
    // Storage path of the KYC face-scan selfie (optional on edit).
    facePath: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => Boolean(v.telegram) || Boolean(v.viber), {
    message: "Add at least one contact: Telegram or Viber.",
    path: ["telegram"],
  });

export type GpayKycInput = z.infer<typeof kycSchema>;

const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(20)
  .regex(/^[0-9+\-\s]+$/, "Enter a valid phone number.");

/** Send a one-time verification code by SMS to the phone being registered. */
export async function requestGpayPhoneOtp(phone: string): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid phone" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  if (!smsConfigured()) {
    return {
      ok: false,
      error: "SMS OTP is not set up yet. Ask the admin to configure it.",
    };
  }

  // 6-digit code; stored bcrypt-hashed by the DB function (never persisted raw).
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const db = await createClient();
  const { error } = await db.rpc("gpay_start_phone_otp", {
    p_phone: parsed.data,
    p_code: code,
  });
  if (error) return { ok: false, error: error.message };

  try {
    await sendSms(parsed.data, `gwave G-Pay verification code: ${code}`);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not send the SMS.",
    };
  }
  return { ok: true, data: undefined };
}

/** Verify the SMS code for the registering phone. */
export async function verifyGpayPhoneOtp(
  phone: string,
  code: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  if (!/^[0-9]{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code." };
  }
  const db = await createClient();
  const { data, error } = await db.rpc("gpay_verify_phone_otp", {
    p_phone: phone,
    p_code: code,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== true) {
    return { ok: false, error: "Wrong or expired code." };
  }
  return { ok: true, data: undefined };
}

/** Register or update the caller's KYC. A new account starts pending. */
export async function saveGpayKyc(input: GpayKycInput): Promise<ActionResult> {
  const parsed = kycSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const v = parsed.data;

  const db0 = await createClient();
  const { data: existing } = await db0
    .from("gpay_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  // A first registration must have a phone confirmed by SMS OTP — but only
  // when SMS is actually configured, so the flow still works before an operator
  // wires up a provider.
  if (!existing && smsConfigured()) {
    const { data: verified } = await db0.rpc("gpay_phone_verified", {
      p_phone: v.phone,
    });
    if (verified !== true) {
      return {
        ok: false,
        error: "Please verify your phone number with the SMS code first.",
      };
    }
  }
  const row: Record<string, unknown> = {
    user_id: userId,
    full_name: v.fullName,
    nrc_number: v.nrcNumber,
    phone: v.phone,
    email: v.email,
    telegram: v.telegram ? v.telegram : null,
    viber: v.viber ? v.viber : null,
    address: v.address,
  };
  // Only overwrite the slip / face when a new one was uploaded, so editing
  // other KYC fields doesn't wipe an existing capture.
  if (v.slipPath) row.slip_path = v.slipPath;
  if (v.facePath) row.face_path = v.facePath;

  const db = await createClient();
  // Upsert on user_id: first submission inserts (pending), later edits update
  // the KYC fields. balance/status are protected by the DB guard trigger.
  const { error } = await db
    .from("gpay_accounts")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    // Surface the common unique-violation on NRC / phone in a friendly way.
    const msg = /duplicate|unique/i.test(error.message)
      ? "That NRC or phone number is already registered."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

/**
 * Cash-in: start a Stripe Checkout to top up the caller's wallet by `amountMmk`
 * G-Pay (= MMK). The card is charged the USD equivalent (Stripe accepts
 * international cards/banks); the webhook credits the wallet on success.
 */
export async function createGpayTopupCheckout(
  amountMmk: number,
): Promise<ActionResult<{ url: string }>> {
  const amount = Math.round(Number(amountMmk));
  if (!Number.isFinite(amount) || amount < 1000 || amount > 10_000_000) {
    return { ok: false, error: "Enter an amount between 1,000 and 10,000,000." };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "Card top-up is not set up yet." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  // Must have an active wallet to credit.
  const { data: acct } = await db
    .from("gpay_accounts")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle<{ status: GpayStatus }>();
  if (acct?.status !== "active") {
    return { ok: false, error: "Your G-Pay account is not active yet." };
  }

  // Convert MMK → USD for the card charge (Stripe minimum ~$0.50).
  const { data: usd } = await db.rpc("gpay_convert", {
    amount,
    from_code: "MMK",
    to_code: "USD",
  });
  const usdAmount = Number(usd);
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return { ok: false, error: "Currency rate unavailable. Try again later." };
  }
  const cents = Math.max(50, Math.round(usdAmount * 100));

  const origin = await requestOrigin();
  try {
    const stripe = getStripe();
    // Omitting payment_method_types lets Stripe offer every method enabled in
    // the dashboard (international cards, bank debits, wallets).
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: {
              name: `G-Pay top-up · ${amount.toLocaleString("en-US")} Ks`,
            },
          },
        },
      ],
      metadata: { type: "gpay_topup", user_id: userId, amount_mmk: String(amount) },
      success_url: `${origin}/gpay?topup=success`,
      cancel_url: `${origin}/gpay?topup=cancel`,
    });
    if (!session.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, data: { url: session.url } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Checkout failed.",
    };
  }
}

const transferSchema = z.object({
  toPhone: z.string().trim().min(5).max(20),
  amount: z.number().min(0.01).max(100_000_000).multipleOf(0.01),
  note: z.string().trim().max(200).optional(),
  pin: z.string().trim().regex(/^[0-9]{4,6}$/).optional().or(z.literal("")),
  // Idempotency key: a retry with the same key won't double-send.
  clientRef: z.string().trim().max(64).optional(),
});

/** Send money to another active account by its KPay/phone number. */
export async function transferGpay(input: {
  toPhone: string;
  amount: number;
  note?: string;
  pin?: string;
  clientRef?: string;
}): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db.rpc("gpay_transfer", {
    p_to_phone: parsed.data.toPhone,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? null,
    p_pin: parsed.data.pin ? parsed.data.pin : null,
    p_client_ref: parsed.data.clientRef ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

const pinSchema = z.string().trim().regex(/^[0-9]{4,6}$/, "PIN must be 4–6 digits");

/** Set or change the caller's transaction PIN. */
export async function setGpayPin(pin: string): Promise<ActionResult> {
  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid PIN" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db.rpc("gpay_set_pin", { p_pin: parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

const statusSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(["pending", "active", "suspended", "rejected"]),
});

/** Admin: approve / suspend / reject an account (server verifies admin via RPC). */
export async function setGpayStatus(input: {
  accountId: string;
  status: GpayStatus;
}): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db.rpc("gpay_set_status", {
    p_account: parsed.data.accountId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

const topupSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().min(0.01).max(100_000_000).multipleOf(0.01),
  note: z.string().trim().max(200).optional(),
});

/** Admin: credit an account (cash-in). Admin is verified inside the RPC. */
export async function topupGpay(input: {
  accountId: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const parsed = topupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db.rpc("gpay_admin_topup", {
    p_account: parsed.data.accountId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}
