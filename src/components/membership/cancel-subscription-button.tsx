"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cancelMySubscription } from "@/lib/actions/membership";

export function CancelSubscriptionButton() {
  const t = useTranslations("membership");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function cancel() {
    startTransition(async () => {
      const result = await cancelMySubscription();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={cancel}
        disabled={pending}
        className="text-destructive hover:text-destructive"
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t("cancelAtPeriodEnd")}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
