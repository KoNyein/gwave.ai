import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/gpay/topup — the native app's G-Pay cash-in.
 *
 * The JSON twin of the web `createGpayTopupCheckout` server action, which
 * authenticates from cookies; the app authenticates from its
 * `Authorization: Bearer <data token>` header instead. Same flow: an MMK
 * amount is converted to USD (gpay_convert), a Stripe Checkout session is
 * created with the `gpay_topup` metadata, and the existing Stripe webhook
 * credits the wallet when the payment succeeds. The app opens the returned
 * URL in the browser — the card entry itself always happens on Stripe's page.
 */
const schema = z.object({
  amount: z.number().min(1000).max(10_000_000),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Card top-up is not set up yet." },
      { status: 503 },
    );
  }

  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter an amount between 1,000 and 10,000,000 Ks." },
      { status: 400 },
    );
  }
  const amount = Math.round(parsed.data.amount);

  const supabase = createAdminClient();

  // Must have an active wallet to credit.
  const { data: acct } = await supabase
    .from("gpay_accounts")
    .select("status")
    .eq("user_id", claims.sub)
    .maybeSingle<{ status: string }>();
  if (acct?.status !== "active") {
    return NextResponse.json(
      { error: "Your G-Pay account is not active yet." },
      { status: 403 },
    );
  }

  // Convert MMK → USD for the card charge (Stripe minimum ~$0.50).
  const { data: usd } = await supabase.rpc("gpay_convert", {
    amount,
    from_code: "MMK",
    to_code: "USD",
  });
  const usdAmount = Number(usd);
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return NextResponse.json(
      { error: "Currency rate unavailable. Try again later." },
      { status: 503 },
    );
  }
  const cents = Math.max(50, Math.round(usdAmount * 100));

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gwave.cc";
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
      metadata: {
        type: "gpay_topup",
        user_id: claims.sub,
        amount_mmk: String(amount),
      },
      success_url: `${site}/gpay?topup=success`,
      cancel_url: `${site}/gpay?topup=cancel`,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start checkout." },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed." },
      { status: 502 },
    );
  }
}
