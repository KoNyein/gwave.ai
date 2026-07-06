"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { followPage, unfollowPage } from "@/lib/actions/pages";

export function FollowPageButton({
  pageId,
  following,
}: {
  pageId: string;
  following: boolean;
}) {
  const t = useTranslations("pages");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      await (following ? unfollowPage(pageId) : followPage(pageId));
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant={following ? "secondary" : "default"}
      onClick={toggle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          {t("following")}
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          {t("follow")}
        </>
      )}
    </Button>
  );
}
