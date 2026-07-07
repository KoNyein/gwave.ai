"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportContent } from "@/lib/actions/admin";

export function ReportDialog({
  target,
  open,
  onOpenChange,
}: {
  target: { postId: string } | { commentId: string } | { profileId: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("report");
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const result = await reportContent(target, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setReason("");
      setDone(false);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary bg-secondary p-4 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            {t("submitted")}
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("placeholder")}
              maxLength={500}
              className="min-h-24"
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button
              className="w-full"
              onClick={submit}
              disabled={pending || reason.trim().length < 3}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("submit")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
