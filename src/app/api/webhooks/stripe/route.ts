import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/types/database";

/**
 * Stripe webhook (signature verified). Uses the service role client because
 * webhook calls carry no user session. Handled events:
 *  - checkout.session.completed → create/activate the subscription + payment
 *  - invoice.paid               → extend the period + record the payment
 *  - customer.subscription.updated / .deleted → status sync
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // G-Pay wallet top-up (cash-in) — credit the wallet and stop.
        if (session.metadata?.type === "gpay_topup") {
          const topupUser = session.metadata.user_id;
          const amountMmk = Number(session.metadata.amount_mmk);
          if (
            topupUser &&
            Number.isFinite(amountMmk) &&
            amountMmk > 0 &&
            session.payment_status === "paid"
          ) {
            // Idempotent on the Stripe session id (stored as the txn reference).
            await admin.rpc("gpay_stripe_topup", {
              p_user: topupUser,
              p_amount: amountMmk,
              p_ref: session.id,
            });
          }
          break;
        }

        const userId =
          session.metadata?.user_id ?? session.client_reference_id;
        const planId = session.metadata?.plan_id;
        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null);
        if (!userId || !planId || !stripeSubscriptionId) break;

        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        // Replace any live subscription (e.g. an abandoned PromptPay pending).
        await admin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId)
          .in("status", ["pending", "active", "past_due"])
          .is("stripe_subscription_id", null);

        const { data: existing } = await admin
          .from("subscriptions")
          .select("id")
          .eq("stripe_subscription_id", stripeSubscriptionId)
          .maybeSingle();

        let subscriptionId = existing?.id ?? null;
        if (subscriptionId) {
          await admin
            .from("subscriptions")
            .update({
              status: "active",
              plan_id: planId,
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd.toISOString(),
            })
            .eq("id", subscriptionId);
        } else {
          const { data: created } = await admin
            .from("subscriptions")
            .insert({
              user_id: userId,
              plan_id: planId,
              provider: "stripe",
              status: "active",
              stripe_subscription_id: stripeSubscriptionId,
              current_period_end: periodEnd.toISOString(),
            })
            .select("id")
            .single();
          subscriptionId = created?.id ?? null;
        }

        if ((session.amount_total ?? 0) > 0) {
          await admin.from("payments").insert({
            user_id: userId,
            subscription_id: subscriptionId,
            provider: "stripe",
            status: "succeeded",
            amount: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? "usd").toUpperCase(),
            stripe_payment_id: session.id,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const stripeSubscriptionId =
          typeof invoice.parent?.subscription_details?.subscription ===
          "string"
            ? invoice.parent.subscription_details.subscription
            : null;
        if (!stripeSubscriptionId) break;

        const { data: subscription } = await admin
          .from("subscriptions")
          .select("id, user_id")
          .eq("stripe_subscription_id", stripeSubscriptionId)
          .maybeSingle();
        if (!subscription) break;

        const periodEnd = invoice.lines.data[0]?.period?.end;
        await admin
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })
          .eq("id", subscription.id);

        // Skip the invoice that Checkout already recorded.
        const { data: existingPayment } = await admin
          .from("payments")
          .select("id")
          .eq("stripe_payment_id", invoice.id ?? "")
          .maybeSingle();
        if (!existingPayment && invoice.amount_paid > 0) {
          await admin.from("payments").insert({
            user_id: subscription.user_id,
            subscription_id: subscription.id,
            provider: "stripe",
            status: "succeeded",
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            stripe_payment_id: invoice.id,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object;
        const statusMap: Record<string, SubscriptionStatus> = {
          active: "active",
          trialing: "active",
          past_due: "past_due",
          unpaid: "past_due",
          canceled: "canceled",
          incomplete: "pending",
          incomplete_expired: "expired",
          paused: "past_due",
        };
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : (statusMap[stripeSubscription.status] ?? "canceled");

        await admin
          .from("subscriptions")
          .update({
            status,
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", stripeSubscription.id);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
