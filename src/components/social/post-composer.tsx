"use client";

import * as React from "react";
import { Globe, ImagePlus, Loader2, Lock, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/lib/actions/posts";
import { displayName } from "@/lib/format";
import { MAX_POST_IMAGES, uploadMedia } from "@/lib/media";
import type { PostVisibility } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  icon: typeof Globe;
  labelKey: "public" | "friends" | "onlyMe";
}[] = [
  { value: "public", icon: Globe, labelKey: "public" },
  { value: "friends", icon: Users, labelKey: "friends" },
  { value: "only_me", icon: Lock, labelKey: "onlyMe" },
];

interface SelectedFile {
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

export function PostComposer({
  currentUser,
  onCreated,
  context,
}: {
  currentUser: AuthorSummary;
  onCreated: () => void;
  /** When set, the post publishes into a group or as a page. */
  context?: { groupId?: string; pageId?: string };
}) {
  const hasContext = Boolean(context?.groupId || context?.pageId);
  const t = useTranslations("composer");
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [visibility, setVisibility] = React.useState<PostVisibility>("public");
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    setContent("");
    setVisibility("public");
    setError(null);
    setFiles((previous) => {
      previous.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list);

    setFiles((previous) => {
      const hasVideo =
        previous.some((f) => f.isVideo) ||
        incoming.some((f) => f.type.startsWith("video/"));
      if (hasVideo && previous.length + incoming.length > 1) {
        setError(t("videoLimit"));
        return previous;
      }
      const next = [...previous];
      for (const file of incoming) {
        if (next.length >= MAX_POST_IMAGES) {
          setError(t("imageLimit"));
          break;
        }
        next.push({
          file,
          previewUrl: URL.createObjectURL(file),
          isVideo: file.type.startsWith("video/"),
        });
      }
      return next;
    });
  }

  function removeFile(index: number) {
    setFiles((previous) => {
      const target = previous[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const media = [];
      for (const selected of files) {
        media.push(await uploadMedia(currentUser.id, selected.file));
      }
      const result = await createPost({
        content,
        visibility,
        media,
        groupId: context?.groupId ?? null,
        pageId: context?.pageId ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
      onCreated();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("uploadFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting && (content.trim().length > 0 || files.length > 0);
  const activeVisibility =
    VISIBILITY_OPTIONS.find((o) => o.value === visibility) ??
    VISIBILITY_OPTIONS[0]!;
  const VisibilityIcon = activeVisibility.icon;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <UserAvatar profile={currentUser} linked={false} />
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex-1 rounded-full bg-muted px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              {t("placeholder")}
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-center">{t("title")}</DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-3">
              <UserAvatar profile={currentUser} linked={false} />
              <div>
                <p className="text-sm font-semibold">
                  {displayName(currentUser)}
                </p>
                {hasContext ? (
                  <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {context?.groupId ? t("toGroup") : t("asPage")}
                  </span>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
                      >
                        <VisibilityIcon className="h-3 w-3" />
                        {t(activeVisibility.labelKey)}
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
                )}
              </div>
            </div>

            <Textarea
              autoFocus
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t("placeholder")}
              className="min-h-28 border-none px-0 text-base shadow-none focus-visible:ring-0"
              maxLength={10000}
            />

            {files.length > 0 ? (
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                {files.map((selected, index) => (
                  <div
                    key={selected.previewUrl}
                    className="relative aspect-square overflow-hidden rounded-md bg-muted"
                  >
                    {selected.isVideo ? (
                      <video
                        src={selected.previewUrl}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      aria-label={t("removeMedia")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex items-center justify-between rounded-lg border p-2">
              <span className="pl-2 text-sm font-medium">{t("addToPost")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("addPhotos")}
              >
                <ImagePlus className="h-5 w-5 text-accent" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("posting")}
                </>
              ) : (
                t("post")
              )}
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
