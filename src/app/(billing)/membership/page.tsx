import { BadgeCheck, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CancelSubscriptionButton } from "@/components/membership/cancel-subscription-button";
import { PlanActions } from "@/components/membership/plan-actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getMySubscription, getPlans } from "@/lib/db/membership";
import { cn } from "@/lib/utils";

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["feed", "groupsPages", "messenger", "knowledge"],
  pro: ["everythingFree", "badge", "memberPosts", "advancedTools"],
  business: ["everythingPro", "teamReady", "prioritySupport"],
};

export default async function MembershipPage(
  props: {
    searchParams: Promise<{ checkout?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const t = await getTranslations("membership");
  const [profile, plans] = await Promise.all([
    getCurrentProfile(),
    getPlans(),
  ]);
  const subscription = profile ? await getMySubscription(profile.id) : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {searchParams.checkout === "success" ? (
        <Card className="border-primary bg-secondary">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <BadgeCheck className="h-5 w-5 text-primary" />
            {t("checkoutSuccess")}
          </CardContent>
        </Card>
      ) : null}
      {searchParams.checkout === "canceled" ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t("checkoutCanceled")}
          </CardContent>
        </Card>
      ) : null}

      {/* Current subscription */}
      {subscription ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("yourSubscription")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p>
                <span className="font-semibold">{subscription.plan.name}</span>{" "}
                ·{" "}
                <span
                  className={cn(
                    "capitalize",
                    subscription.status === "active"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {subscription.status.replace("_", " ")}
                </span>
              </p>
              <p className="text-muted-foreground">
                {subscription.status === "pending"
                  ? t("pendingReview")
                  : subscription.current_period_end
                    ? t("renewsOn", {
                        date: new Date(
                          subscription.current_period_end,
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }),
                      })
                    : ""}
                {subscription.cancel_at_period_end
                  ? ` — ${t("cancelsAtPeriodEnd")}`
                  : ""}
              </p>
            </div>
            {subscription.status !== "pending" &&
            !subscription.cancel_at_period_end ? (
              <CancelSubscriptionButton />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan_id === plan.id && subscription.status === "active";
          const highlighted = plan.id === "pro";
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col",
                highlighted && "border-primary shadow-md",
              )}
            >
              <CardHeader className="pb-2">
                {highlighted ? (
                  <span className="mb-1 w-fit rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                    {t("mostPopular")}
                  </span>
                ) : null}
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-3xl font-bold">
                  ${plan.price_monthly}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{t("month")}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <ul className="flex-1 space-y-2 text-sm">
                  {(PLAN_FEATURES[plan.id] ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {t(`features.${feature}`)}
                    </li>
                  ))}
                </ul>
                <PlanActions
                  planId={plan.id}
                  isCurrent={
                    isCurrent || (plan.id === "free" && !subscription)
                  }
                  loggedIn={profile !== null}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
