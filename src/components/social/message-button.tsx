"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { openDirectConversation } from "@/lib/actions/messages";

/**
 * Starts (or opens) a direct conversation with another user and jumps to it.
 * Works for anyone — you no longer need to be friends first, which is what
 * made the messenger unreachable when you had no accepted friends yet.
 */
export function MessageButton({ profileId }: { profileId: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openDirectConversation(profileId);
          if (result.ok) {
            router.push(`/messages?c=${result.data.conversationId}`);
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="mr-1.5 h-4 w-4" />
      )}
      {t("message")}
    </Button>
  );
}
