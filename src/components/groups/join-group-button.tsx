"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, LogOut, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { joinGroup, leaveGroup } from "@/lib/actions/groups";
import type { GroupMembershipState } from "@/lib/db/groups";

export function JoinGroupButton({
  groupId,
  membership,
  isOwner,
}: {
  groupId: string;
  membership: GroupMembershipState;
  isOwner: boolean;
}) {
  const t = useTranslations("groups");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (pending) {
    return (
      <Button disabled size="sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (membership.kind === "none") {
    return (
      <Button size="sm" onClick={() => run(() => joinGroup(groupId))}>
        <Plus className="mr-2 h-4 w-4" />
        {t("join")}
      </Button>
    );
  }

  if (membership.kind === "pending") {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => run(() => leaveGroup(groupId))}
      >
        <Clock className="mr-2 h-4 w-4" />
        {t("requested")}
      </Button>
    );
  }

  // The owner cannot leave their own group (they'd have to delete it).
  if (isOwner) {
    return (
      <Button size="sm" variant="secondary" disabled>
        <Check className="mr-2 h-4 w-4" />
        {t("owner")}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Check className="mr-2 h-4 w-4" />
          {t("joined")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => run(() => leaveGroup(groupId))}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("leave")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
