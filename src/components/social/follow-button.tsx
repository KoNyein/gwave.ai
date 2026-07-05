"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rss } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/lib/actions/friends";

export function FollowButton({
  profileId,
  following,
}: {
  profileId: string;
  following: boolean;
}) {
  const t = useTranslations("friends");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      await (following ? unfollowUser(profileId) : followUser(profileId));
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant={following ? "secondary" : "outline"}
      onClick={toggle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Rss className="mr-2 h-4 w-4" />
          {following ? t("following") : t("follow")}
        </>
      )}
    </Button>
  );
}
