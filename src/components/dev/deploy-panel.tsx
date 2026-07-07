"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { triggerRedeploy } from "@/lib/actions/dev";

export function DeployPanel({ configured }: { configured: boolean }) {
  const t = useTranslations("dev");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function deploy() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await triggerRedeploy();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.data.message);
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={deploy} disabled={pending || !configured}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="mr-2 h-4 w-4" />
        )}
        {t("redeploy")}
      </Button>
      {!configured ? (
        <p className="text-sm text-muted-foreground">{t("coolifyNotConfigured")}</p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
