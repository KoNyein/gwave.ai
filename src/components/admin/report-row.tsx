"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { resolveReport } from "@/lib/actions/admin";
import type { ReportWithContext } from "@/lib/db/admin";
import { displayName, timeAgo } from "@/lib/format";

export function ReportRow({ report }: { report: ReportWithContext }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: "remove" | "dismiss") {
    startTransition(async () => {
      await resolveReport(report.id, action);
      router.refresh();
    });
  }

  const content = report.post ?? report.comment;

  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <UserAvatar
            profile={report.reporter}
            linked={false}
            className="h-7 w-7"
          />
          <span>
            <span className="font-semibold">
              {displayName(report.reporter)}
            </span>{" "}
            {t("reported")}{" "}
            <span className="font-medium">
              {report.post_id
                ? t("aPost")
                : report.comment_id
                  ? t("aComment")
                  : t("aProfile")}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {timeAgo(report.created_at)}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => run("remove")}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {t("removeContent")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run("dismiss")}>
                <Check className="mr-1 h-4 w-4" />
                {t("dismiss")}
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">
        <span className="font-medium">{t("reasonLabel")}:</span> {report.reason}
      </p>

      {content ? (
        <div className="rounded-lg border p-3">
          <p className="mb-1 text-xs text-muted-foreground">
            {t("by")} {displayName(content.author)}
          </p>
          <p className="line-clamp-4 whitespace-pre-wrap text-sm">
            {content.content || t("mediaOnly")}
          </p>
        </div>
      ) : report.profile ? (
        <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <UserAvatar
            profile={report.profile}
            linked={false}
            className="h-7 w-7"
          />
          <span className="font-medium">{displayName(report.profile)}</span>
          <span className="text-xs text-muted-foreground">
            {t("profileReportHint")}
          </span>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t("contentGone")}
        </p>
      )}
    </div>
  );
}
