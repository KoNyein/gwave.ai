import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { smsConfigured } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Native G-Pay registration: the same KYC upsert as the web's saveGpayKyc
// action, exposed to the app so the wallet can be opened without a browser
// hand-off. balance/status stay protected by the table's guard trigger — this
// only writes the KYC columns, so a fresh row starts 'pending' as usual.

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  nrcNumber: z.string().trim().min(4).max(40),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Enter a valid phone number."),
  email: z.string().trim().email().max(160),
  telegram: z.string().trim().max(80).optional().default(""),
  viber: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().min(3).max(300),
});

/** POST /api/mobile/gpay/register — create/update the caller's KYC. */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details." },
      { status: 400 },
    );
  }
  const v = parsed.data;
  if (!v.telegram && !v.viber) {
    return NextResponse.json(
      { error: "Add a Telegram or Viber contact." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("gpay_accounts")
    .select("id")
    .eq("user_id", claims.sub)
    .maybeSingle();

  // Same gate as the web: a first registration needs an SMS-verified phone,
  // but only when an SMS provider is actually configured.
  if (!existing && smsConfigured()) {
    const { data: verified } = await admin.rpc("gpay_phone_verified", {
      p_phone: v.phone,
    });
    if (verified !== true) {
      return NextResponse.json(
        { error: "Please verify your phone number on gwave.cc first." },
        { status: 400 },
      );
    }
  }

  const { error } = await admin.from("gpay_accounts").upsert(
    {
      user_id: claims.sub,
      full_name: v.fullName,
      nrc_number: v.nrcNumber,
      phone: v.phone,
      email: v.email,
      telegram: v.telegram || null,
      viber: v.viber || null,
      address: v.address,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    const message = /duplicate|unique/i.test(error.message)
      ? "That NRC or phone number is already registered."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: account } = await admin
    .from("gpay_accounts")
    .select("id, status, balance, full_name, phone")
    .eq("user_id", claims.sub)
    .maybeSingle();
  return NextResponse.json({ account: account ?? null });
}
