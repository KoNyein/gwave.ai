"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { ReportDialog } from "@/components/social/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, unblockUser } from "@/lib/actions/moderation";

/** Report / block menu shown on another user's profile. */
export function ProfileActions({
  profileId,
  initiallyBlocked,
}: {
  profileId: string;
  initiallyBlocked: boolean;
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [blocked, setBlocked] = React.useState(initiallyBlocked);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function toggleBlock() {
    startTransition(async () => {
      const result = blocked
        ? await unblockUser(profileId)
        : await blockUser(profileId);
      if (result.ok) {
        setBlocked(!blocked);
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("moreActions")}
            disabled={pending}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>
            <Flag className="mr-2 h-4 w-4" />
            {t("reportUser")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={toggleBlock}
          >
            {blocked ? (
              <Undo2 className="mr-2 h-4 w-4" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}
            {blocked ? t("unblockUser") : t("blockUser")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog
        target={{ profileId }}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}
