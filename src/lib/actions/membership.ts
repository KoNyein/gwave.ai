"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();
const planId = z.enum(["pro", "business"]);

/** USD→THB rate from the admin-editable currency table (fallback 36). */
export async function getThbRate(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("currency_rates")
    .select("rate_per_usd")
    .eq("code", "THB")
    .maybeSingle();
  return data ? Number(data.rate_per_usd) : 36;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return null;
  }
  return user.id;
}

function revalidateMembership() {
  revalidatePath("/membership");
  revalidatePath("/admin/membership");
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

/** Creates a Stripe Checkout session for a paid plan; returns its URL. */
export async function createStripeCheckout(
  plan: string,
): Promise<ActionResult<{ url: string }>> {
  const parsedPlan = planId.safeParse(plan);
  if (!parsedPlan.success) return { ok: false, error: "Invalid plan." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: planRow } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("id", parsedPlan.data)
    .eq("active", true)
    .maybeSingle();
  if (!planRow) return { ok: false, error: "Plan not found." };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { ok: false, error: "Stripe is not configured on this server." };
  }

  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,
      customer_email: user.email,
      line_items: [
        planRow.stripe_price_id
          ? { price: planRow.stripe_price_id, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: planRow.currency.toLowerCase(),
                unit_amount: Math.round(planRow.price_monthly * 100),
                recurring: { interval: "month" },
                product_data: {
                  name: `gwave.ai ${planRow.name} membership`,
                },
              },
            },
      ],
      metadata: { user_id: user.id, plan_id: planRow.id },
      subscription_data: {
        metadata: { user_id: user.id, plan_id: planRow.id },
      },
      success_url: `${siteUrl}/membership?checkout=success`,
      cancel_url: `${siteUrl}/membership?checkout=canceled`,
    });
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }
    return { ok: true, data: { url: session.url } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe checkout failed.";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// PromptPay
// ---------------------------------------------------------------------------

const promptPaySchema = z.object({
  plan: planId,
  slipPath: z.string().min(1).max(500),
});

/**
 * Records an uploaded PromptPay slip: creates (or reuses) the user's pending
 * subscription and a payment awaiting admin review.
 */
export async function submitPromptPayPayment(
  input: z.infer<typeof promptPaySchema>,
): Promise<ActionResult> {
  const parsed = promptPaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };

  const supabase = await createClient();
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const { data: planRow } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("id", parsed.data.plan)
    .eq("active", true)
    .maybeSingle();
  if (!planRow) return { ok: false, error: "Plan not found." };

  // Reuse an existing live subscription row or start a pending one.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "active", "past_due"])
    .maybeSingle();

  let subscriptionId = existing?.id ?? null;
  if (!subscriptionId) {
    const { data: created, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: planRow.id,
        provider: "promptpay",
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: error?.message ?? "Failed to subscribe." };
    }
    subscriptionId = created.id;
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    user_id: userId,
    subscription_id: subscriptionId,
    provider: "promptpay",
    status: "awaiting_review",
    amount: planRow.price_monthly,
    currency: planRow.currency,
    slip_path: parsed.data.slipPath,
    note: `PromptPay slip for ${planRow.name} plan`,
  });
  if (paymentError) return { ok: false, error: paymentError.message };

  revalidateMembership();
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Admin review / management
// ---------------------------------------------------------------------------

/** Admin: approve a PromptPay slip — payment succeeds, membership activates. */
export async function approvePayment(
  paymentId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(paymentId).success) {
    return { ok: false, error: "Invalid payment." };
  }
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("status", "awaiting_review")
    .maybeSingle();
  if (!payment) return { ok: false, error: "Payment not found." };

  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status: "succeeded",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (paymentError) return { ok: false, error: paymentError.message };

  if (payment.subscription_id) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", payment.subscription_id);
    if (subscriptionError) {
      return { ok: false, error: subscriptionError.message };
    }
  }

  revalidateMembership();
  return { ok: true, data: undefined };
}

/** Admin: reject a PromptPay slip; a pending subscription is canceled. */
export async function rejectPayment(
  paymentId: string,
  note?: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(paymentId).success) {
    return { ok: false, error: "Invalid payment." };
  }
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, subscription_id")
    .eq("id", paymentId)
    .eq("status", "awaiting_review")
    .maybeSingle();
  if (!payment) return { ok: false, error: "Payment not found." };

  const { error } = await supabase
    .from("payments")
    .update({
      status: "rejected",
      note: note?.slice(0, 500) ?? null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  if (payment.subscription_id) {
    await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("id", payment.subscription_id)
      .eq("status", "pending");
  }

  revalidateMembership();
  return { ok: true, data: undefined };
}

const grantSchema = z.object({
  username: z.string().min(3).max(30),
  plan: planId,
  days: z.number().int().min(1).max(3650),
});

/** Admin: manually grant a membership (uses the service role for insert). */
export async function grantMembership(
  input: z.infer<typeof grantSchema>,
): Promise<ActionResult> {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid grant." };

  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found." };

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + parsed.data.days);

  const admin = createAdminClient();
  // End any live subscription first, then grant the manual one.
  await admin
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", target.id)
    .in("status", ["pending", "active", "past_due"]);
  const { error } = await admin.from("subscriptions").insert({
    user_id: target.id,
    plan_id: parsed.data.plan,
    provider: "manual",
    status: "active",
    current_period_end: periodEnd.toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidateMembership();
  return { ok: true, data: undefined };
}

/** Admin: extend a subscription by N days. */
export async function extendMembership(
  subscriptionId: string,
  days: number,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(subscriptionId).success ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 3650
  ) {
    return { ok: false, error: "Invalid extension." };
  }
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!subscription) return { ok: false, error: "Subscription not found." };

  const base = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date();
  base.setDate(base.getDate() + days);

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active", current_period_end: base.toISOString() })
    .eq("id", subscriptionId);
  if (error) return { ok: false, error: error.message };

  revalidateMembership();
  return { ok: true, data: undefined };
}

/** Admin: revoke a subscription immediately. */
export async function revokeMembership(
  subscriptionId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(subscriptionId).success) {
    return { ok: false, error: "Invalid subscription." };
  }
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", subscriptionId);
  if (error) return { ok: false, error: error.message };

  revalidateMembership();
  return { ok: true, data: undefined };
}

/**
 * User: cancel at period end. Ownership is verified here, then the service
 * role applies the flag (users have no direct update rights on
 * subscriptions — see RLS).
 */
export async function cancelMySubscription(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, provider, stripe_subscription_id")
    .eq("user_id", userId)
    .in("status", ["active", "past_due", "pending"])
    .maybeSingle();
  if (!subscription) return { ok: false, error: "No active subscription." };

  if (subscription.provider === "stripe" && subscription.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Stripe cancellation failed.";
      return { ok: false, error: message };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("id", subscription.id);
  if (error) return { ok: false, error: error.message };

  revalidateMembership();
  return { ok: true, data: undefined };
}
