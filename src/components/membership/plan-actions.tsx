"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { createStripeCheckout } from "@/lib/actions/membership";

export function PlanActions({
  planId,
  isCurrent,
  loggedIn,
}: {
  planId: string;
  isCurrent: boolean;
  loggedIn: boolean;
}) {
  const t = useTranslations("membership");
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (planId === "free") {
    return (
      <Button variant="secondary" className="w-full" disabled>
        {isCurrent ? t("currentPlan") : t("freeForever")}
      </Button>
    );
  }

  if (isCurrent) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        {t("currentPlan")}
      </Button>
    );
  }

  if (!loggedIn) {
    return (
      <Button className="w-full" asChild>
        <Link href={`/login?redirectTo=/membership`}>{t("loginToSubscribe")}</Link>
      </Button>
    );
  }

  async function checkout() {
    setLoading(true);
    setError(null);
    const result = await createStripeCheckout(planId);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(result.data.url);
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={checkout} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        {t("subscribeWithCard")}
      </Button>
      <Button variant="outline" className="w-full" asChild>
        <Link href={`/membership/promptpay/${planId}`}>
          <QrCode className="mr-2 h-4 w-4" />
          {t("payWithPromptPay")}
        </Link>
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
