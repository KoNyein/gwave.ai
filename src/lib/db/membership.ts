import "server-only";

import { createClient } from "@/lib/data/server";
import type {
  MembershipPlan,
  Payment,
  Subscription,
} from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface SubscriptionWithPlan extends Subscription {
  plan: MembershipPlan;
}

export interface PaymentWithProfile extends Payment {
  profile: AuthorSummary;
}

export interface MemberRow {
  subscription: SubscriptionWithPlan;
  profile: AuthorSummary;
}

export async function getPlans(): Promise<MembershipPlan[]> {
  const db = await createClient();
  const { data } = await db
    .from("membership_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return data ?? [];
}

/** The user's live subscription (pending/active/past_due), if any. */
export async function getMySubscription(
  userId: string,
): Promise<SubscriptionWithPlan | null> {
  const db = await createClient();
  const { data } = await db
    .from("subscriptions")
    .select("*, plan:membership_plans!subscriptions_plan_id_fkey(*)")
    .eq("user_id", userId)
    .in("status", ["pending", "active", "past_due"])
    .maybeSingle<SubscriptionWithPlan>();
  return data;
}

/** PromptPay payments waiting for admin review. */
export async function getReviewQueue(): Promise<PaymentWithProfile[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("payments")
    .select(
      "*, profile:profiles!payments_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("status", "awaiting_review")
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<PaymentWithProfile[]>();
  // A swallowed error would render an empty payment-review queue during a failure,
  // so an admin sees no payments to review while paying users wait to be activated.
  // Throw so the /admin error boundary shows a retry instead of a false all-clear.
  if (error) {
    throw new Error(`Failed to load the payment review queue: ${error.message}`);
  }
  return data ?? [];
}

/** All live subscriptions with their owners (admin member table). */
export async function getMembers(search?: string): Promise<MemberRow[]> {
  const db = await createClient();
  let profileFilter: string[] | null = null;

  if (search && search.trim().length >= 2) {
    const pattern = `%${search.trim().replace(/[%_\\]/g, "\\$&")}%`;
    const { data: profiles } = await db
      .from("profiles")
      .select("id")
      .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
      .limit(50);
    profileFilter = (profiles ?? []).map((p) => p.id);
    if (profileFilter.length === 0) return [];
  }

  let query = db
    .from("subscriptions")
    .select(
      `*,
       plan:membership_plans!subscriptions_plan_id_fkey(*),
       profile:profiles!subscriptions_user_id_fkey(id, username, full_name, avatar_url)`,
    )
    .in("status", ["pending", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (profileFilter) {
    query = query.in("user_id", profileFilter);
  }

  const { data } = await query.returns<
    (SubscriptionWithPlan & { profile: AuthorSummary })[]
  >();
  return (data ?? []).map(({ profile, ...subscription }) => ({
    subscription,
    profile,
  }));
}

export interface RevenuePoint {
  month: string;
  total: number;
}

/** Succeeded payment totals per month for the last 12 months. */
export async function getRevenueByMonth(): Promise<RevenuePoint[]> {
  const db = await createClient();
  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);

  const { data } = await db
    .from("payments")
    .select("amount, created_at")
    .eq("status", "succeeded")
    .gte("created_at", since.toISOString())
    .limit(5000);

  const buckets = new Map<string, number>();
  for (const payment of data ?? []) {
    const month = payment.created_at.slice(0, 7);
    buckets.set(month, (buckets.get(month) ?? 0) + Number(payment.amount));
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
}

export interface MembershipStats {
  activeMembers: number;
  pendingReviews: number;
  revenueThisMonth: number;
}

export async function getMembershipStats(): Promise<MembershipStats> {
  const db = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [activeRes, reviewRes, revenueRes] = await Promise.all([
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_review"),
    db
      .from("payments")
      .select("amount")
      .eq("status", "succeeded")
      .gte("created_at", monthStart.toISOString())
      .limit(5000),
  ]);

  const revenueThisMonth = (revenueRes.data ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  return {
    activeMembers: activeRes.count ?? 0,
    pendingReviews: reviewRes.count ?? 0,
    revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
  };
}
