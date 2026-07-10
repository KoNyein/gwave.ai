"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";
import type { GpayStatus } from "@/types/database";

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  })
  .refine((v) => Boolean(v.telegram) || Boolean(v.viber), {
    message: "Add at least one contact: Telegram or Viber.",
    path: ["telegram"],
  });

export type GpayKycInput = z.infer<typeof kycSchema>;

/** Register or update the caller's KYC. A new account starts pending. */
export async function saveGpayKyc(input: GpayKycInput): Promise<ActionResult> {
  const parsed = kycSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const v = parsed.data;
  const row = {
    user_id: userId,
    full_name: v.fullName,
    nrc_number: v.nrcNumber,
    phone: v.phone,
    email: v.email,
    telegram: v.telegram ? v.telegram : null,
    viber: v.viber ? v.viber : null,
    address: v.address,
  };

  const supabase = await createClient();
  // Upsert on user_id: first submission inserts (pending), later edits update
  // the KYC fields. balance/status are protected by the DB guard trigger.
  const { error } = await supabase
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

const transferSchema = z.object({
  toPhone: z.string().trim().min(5).max(20),
  amount: z.number().positive().max(100_000_000),
  note: z.string().trim().max(200).optional(),
});

/** Send money to another active account by its KPay/phone number. */
export async function transferGpay(input: {
  toPhone: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("gpay_transfer", {
    p_to_phone: parsed.data.toPhone,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? null,
  });
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("gpay_set_status", {
    p_account: parsed.data.accountId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

const topupSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive().max(100_000_000),
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("gpay_admin_topup", {
    p_account: parsed.data.accountId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}
