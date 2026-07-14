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
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await openDirectConversation(profileId);
            if (result.ok) {
              router.push(`/messages?c=${result.data.conversationId}`);
            } else {
              // Surface the failure instead of silently doing nothing, so a
              // broken messenger path is obvious rather than a dead button.
              setError("စကားပြောခန်း ဖွင့်၍ မရပါ။ ထပ်ကြိုးစားပါ။");
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
