"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, ShieldAlert, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelAccountDeletion,
  exportMyData,
  requestAccountDeletion,
} from "@/lib/actions/privacy";

export function PrivacySettings({
  deletionPending,
}: {
  deletionPending: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function download() {
    startTransition(async () => {
      const result = await exportMyData();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const url = URL.createObjectURL(
        new Blob([result.data], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "gwave-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function toggleDeletion() {
    startTransition(async () => {
      const result = deletionPending
        ? await cancelAccountDeletion()
        : await requestAccountDeletion();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("privacyTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("exportTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("exportHint")}</p>
          </div>
          <Button variant="outline" onClick={download} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t("exportButton")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div>
            <p className="text-sm font-medium">
              {deletionPending ? t("deletionPendingTitle") : t("deleteTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {deletionPending ? t("deletionPendingHint") : t("deleteHint")}
            </p>
          </div>
          <Button
            variant={deletionPending ? "outline" : "destructive"}
            onClick={toggleDeletion}
            disabled={pending}
          >
            {deletionPending ? (
              <Undo2 className="mr-2 h-4 w-4" />
            ) : (
              <ShieldAlert className="mr-2 h-4 w-4" />
            )}
            {deletionPending ? t("cancelDeletion") : t("requestDeletion")}
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
