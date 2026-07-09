"use client";

import * as React from "react";
import { BadgeCheck, Globe, Loader2, Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { updatePost } from "@/lib/actions/posts";
import type { PostVisibility } from "@/types/database";

// Same audience options/keys as the composer (composer.* namespace).
const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  labelKey: "public" | "friends" | "onlyMe" | "members";
  icon: typeof Globe;
}[] = [
  { value: "public", labelKey: "public", icon: Globe },
  { value: "friends", labelKey: "friends", icon: Users },
  { value: "only_me", labelKey: "onlyMe", icon: Lock },
  { value: "members", labelKey: "members", icon: BadgeCheck },
];

/** Facebook-style post editing: change the text and audience in place. */
export function EditPostDialog({
  postId,
  initialContent,
  initialVisibility,
  open,
  onOpenChange,
  onSaved,
}: {
  postId: string;
  initialContent: string;
  initialVisibility: PostVisibility;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (content: string, visibility: PostVisibility) => void;
}) {
  const t = useTranslations("composer");
  const [content, setContent] = React.useState(initialContent);
  const [visibility, setVisibility] =
    React.useState<PostVisibility>(initialVisibility);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setContent(initialContent);
      setVisibility(initialVisibility);
      setError(null);
    }
  }, [open, initialContent, initialVisibility]);

  const active =
    VISIBILITY_OPTIONS.find((o) => o.value === visibility) ??
    VISIBILITY_OPTIONS[0]!;
  const ActiveIcon = active.icon;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePost({ postId, content, visibility });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(content.trim(), visibility);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-center">{t("editTitle")}</DialogTitle>
        </DialogHeader>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-fit items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              <ActiveIcon className="h-3 w-3" />
              {t(active.labelKey)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {VISIBILITY_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setVisibility(option.value)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {t(option.labelKey)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          autoFocus
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-28 text-base"
          maxLength={10000}
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("saving")}
            </>
          ) : (
            t("saveChanges")
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
