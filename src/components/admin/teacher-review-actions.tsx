"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewTeacherApplication } from "@/lib/actions/teachers";

/** Approve/reject buttons for one teacher application. */
export function TeacherReviewActions({ applicationId }: { applicationId: string }) {
  const t = useTranslations("learn");
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function decide(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await reviewTeacherApplication(applicationId, decision, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("reviewNotePlaceholder")}
        maxLength={500}
        className="h-8 w-56 text-xs"
      />
      <Button size="sm" disabled={pending} onClick={() => decide("approved")}>
        {pending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="mr-1 h-3.5 w-3.5" />
        )}
        {t("approve")}
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => decide("rejected")}>
        <X className="mr-1 h-3.5 w-3.5" /> {t("reject")}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
