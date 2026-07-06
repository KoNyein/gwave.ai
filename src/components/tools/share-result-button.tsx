"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { createPost } from "@/lib/actions/posts";

/** Publishes a formatted calculator result to the feed as a public post. */
export function ShareResultButton({
  content,
  disabled,
}: {
  content: string;
  disabled?: boolean;
}) {
  const t = useTranslations("tools");
  const [pending, startTransition] = React.useTransition();
  const [shared, setShared] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function share() {
    setError(null);
    startTransition(async () => {
      const result = await createPost({
        content,
        visibility: "public",
        media: [],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShared(true);
    });
  }

  if (shared) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary">
        <Check className="h-4 w-4" />
        {t("shared")}
        <Link href="/feed" className="font-medium underline">
          {t("viewFeed")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={share}
        disabled={disabled || pending}
      >
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        {t("shareAsPost")}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
