"use client";

import * as React from "react";
import { Globe, Loader2, Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { sharePost } from "@/lib/actions/posts";
import { displayName } from "@/lib/format";
import type { PostVisibility } from "@/types/database";
import type { AuthorSummary, FeedPost } from "@/types/social";

const VISIBILITY_ICONS: Record<PostVisibility, typeof Globe> = {
  public: Globe,
  friends: Users,
  only_me: Lock,
};

export function ShareDialog({
  post,
  currentUser,
  open,
  onOpenChange,
  onShared,
}: {
  post: FeedPost;
  currentUser: AuthorSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared: () => void;
}) {
  const t = useTranslations("share");
  const tComposer = useTranslations("composer");
  const [content, setContent] = React.useState("");
  const [visibility, setVisibility] = React.useState<PostVisibility>("public");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const original = post.shared_post ?? post;
  const VisibilityIcon = VISIBILITY_ICONS[visibility];
  const visibilityLabel = {
    public: tComposer("public"),
    friends: tComposer("friends"),
    only_me: tComposer("onlyMe"),
  }[visibility];

  async function handleShare() {
    setSubmitting(true);
    setError(null);
    const result = await sharePost({ postId: post.id, content, visibility });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setContent("");
    onOpenChange(false);
    onShared();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-center">{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <UserAvatar profile={currentUser} linked={false} />
          <div>
            <p className="text-sm font-semibold">{displayName(currentUser)}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
                >
                  <VisibilityIcon className="h-3 w-3" />
                  {visibilityLabel}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(["public", "friends", "only_me"] as const).map((value) => {
                  const Icon = VISIBILITY_ICONS[value];
                  return (
                    <DropdownMenuItem
                      key={value}
                      onSelect={() => setVisibility(value)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {
                        {
                          public: tComposer("public"),
                          friends: tComposer("friends"),
                          only_me: tComposer("onlyMe"),
                        }[value]
                      }
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("placeholder")}
          className="min-h-20 border-none px-0 shadow-none focus-visible:ring-0"
          maxLength={10000}
        />

        <div className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">{displayName(original.author)}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
            {original.content || t("mediaPost")}
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={handleShare} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("sharing")}
            </>
          ) : (
            t("shareNow")
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
