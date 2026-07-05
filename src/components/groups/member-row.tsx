"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Shield, UserMinus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  approveGroupMember,
  leaveGroup,
  setGroupMemberRole,
} from "@/lib/actions/groups";
import type { GroupMemberWithProfile } from "@/lib/db/groups";
import { displayName } from "@/lib/format";

export function MemberRow({
  member,
  groupId,
  canManage,
  isPendingRequest = false,
}: {
  member: GroupMemberWithProfile;
  groupId: string;
  /** Viewer is a group admin/moderator and may manage this member. */
  canManage: boolean;
  isPendingRequest?: boolean;
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

  const profile = member.profile;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Link
        href={profile.username ? `/u/${profile.username}` : "#"}
        className="flex min-w-0 items-center gap-3"
      >
        <UserAvatar profile={profile} linked={false} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {displayName(profile)}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {isPendingRequest ? t("pendingRequest") : member.role}
          </p>
        </div>
      </Link>

      {canManage ? (
        <div className="flex shrink-0 gap-2">
          {isPendingRequest ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => approveGroupMember(groupId, member.user_id))
                }
              >
                <Check className="mr-1 h-4 w-4" />
                {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => leaveGroup(groupId, member.user_id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={pending}
                  aria-label={t("manageMember")}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {member.role === "member" ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      run(() =>
                        setGroupMemberRole(groupId, member.user_id, "moderator"),
                      )
                    }
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    {t("makeModerator")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() =>
                      run(() =>
                        setGroupMemberRole(groupId, member.user_id, "member"),
                      )
                    }
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    {t("removeModerator")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() =>
                    run(() => leaveGroup(groupId, member.user_id))
                  }
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  {t("removeMember")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : null}
    </div>
  );
}
