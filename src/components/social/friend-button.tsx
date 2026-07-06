"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, UserMinus, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  acceptFriendRequest,
  removeFriendship,
  sendFriendRequest,
} from "@/lib/actions/friends";
import type { FriendState } from "@/types/social";

export function FriendButton({
  profileId,
  state,
}: {
  profileId: string;
  state: FriendState;
}) {
  const t = useTranslations("friends");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (state.kind === "self" || state.kind === "blocked") return null;

  if (pending) {
    return (
      <Button disabled size="sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  switch (state.kind) {
    case "none":
      return (
        <Button size="sm" onClick={() => run(() => sendFriendRequest(profileId))}>
          <UserPlus className="mr-2 h-4 w-4" />
          {t("addFriend")}
        </Button>
      );
    case "request_sent":
      return (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => run(() => removeFriendship(state.friendshipId))}
        >
          <Clock className="mr-2 h-4 w-4" />
          {t("cancelRequest")}
        </Button>
      );
    case "request_received":
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => run(() => acceptFriendRequest(state.friendshipId))}
          >
            <Check className="mr-2 h-4 w-4" />
            {t("accept")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run(() => removeFriendship(state.friendshipId))}
          >
            <X className="mr-2 h-4 w-4" />
            {t("decline")}
          </Button>
        </div>
      );
    case "friends":
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary">
              <Check className="mr-2 h-4 w-4" />
              {t("friends")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => run(() => removeFriendship(state.friendshipId))}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              {t("unfriend")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
  }
}
