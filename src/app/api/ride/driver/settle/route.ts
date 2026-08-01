import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { approvedDriver, rideCaller } from "@/lib/ride/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A driver pays down what they owe on cash trips, out of their G-Pay wallet.
 *
 * The debt exists because a cash fare never passed through the platform, so
 * this is the only path by which that commission actually arrives. Until this
 * route existed the ledger was correct and the money still wasn't moving.
 *
 * The arithmetic and the locking live in `ride_driver_settle()`: it takes the
 * balance row FOR UPDATE, refuses to accept more than is owed, refuses on an
 * insufficient wallet, moves driver → platform in one transaction and appends
 * the ledger row. Doing any of that here would mean a second implementation of
 * the same rules, which is how two implementations disagree.
 *
 * A suspended driver may still settle. Suspension stops them earning; it is not
 * a reason to refuse their money and leave a debt outstanding — which is why
 * this checks for a driver record rather than for approval.
 */

const settleSchema = z.object({
  amount: z.number().positive().max(10_000_000),
});

export async function POST(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = settleSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }
  // Whole Kyat, matching every other amount in the feature.
  const amount = Math.round(parsed.data.amount);
  if (amount < 1) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: driver } = await admin
    .from("ride_driver_profiles")
    .select("user_id")
    .eq("user_id", me.id)
    .maybeSingle<{ user_id: string }>();
  if (!driver) {
    return NextResponse.json({ error: "You are not a driver." }, { status: 403 });
  }

  const { error } = await admin.rpc("ride_driver_settle", {
    p_driver: me.id,
    p_amount: amount,
  });
  if (error) {
    // The function's messages are already written for a person — "That is more
    // than the 450.00 owed", "Insufficient G-Pay balance" — so pass them
    // through rather than replacing them with something vaguer.
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  const { data: balance } = await admin
    .from("ride_driver_balances")
    .select("commission_owed")
    .eq("driver_id", me.id)
    .maybeSingle<{ commission_owed: number }>();

  return NextResponse.json({
    ok: true,
    commissionOwed: balance?.commission_owed ?? 0,
  });
}

/** Kept so the settle sheet can show the number without a second round trip. */
export async function GET(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await approvedDriver(me.id))) {
    return NextResponse.json({ error: "Drivers only." }, { status: 403 });
  }

  const admin = createAdminClient();
  const [{ data: balance }, { data: wallet }] = await Promise.all([
    admin
      .from("ride_driver_balances")
      .select("commission_owed")
      .eq("driver_id", me.id)
      .maybeSingle<{ commission_owed: number }>(),
    admin
      .from("gpay_accounts")
      .select("balance, status")
      .eq("user_id", me.id)
      .maybeSingle<{ balance: number; status: string }>(),
  ]);

  return NextResponse.json({
    commissionOwed: balance?.commission_owed ?? 0,
    walletBalance: wallet?.status === "active" ? wallet.balance : null,
  });
}
