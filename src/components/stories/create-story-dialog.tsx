"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStory } from "@/lib/actions/stories";
import { uploadMedia } from "@/lib/media";
import type { AuthorSummary } from "@/types/social";

export function CreateStoryDialog({
  currentUser,
  children,
}: {
  currentUser: AuthorSummary;
  children: React.ReactNode;
}) {
  const t = useTranslations("stories");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [textOverlay, setTextOverlay] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setTextOverlay("");
      setError(null);
    }
  }

  function selectFile(selected: File | null) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError(t("imageOnly"));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setError(null);
  }

  async function handleSubmit() {
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const uploaded = await uploadMedia(currentUser.id, file);
      const result = await createStory({
        mediaPath: uploaded.storage_path,
        mediaType: uploaded.media_type,
        textOverlay: textOverlay || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("uploadFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {previewUrl ? (
            <div className="relative mx-auto aspect-[9/16] max-h-96 overflow-hidden rounded-lg bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="h-full w-full object-contain"
              />
              {textOverlay ? (
                <p className="absolute inset-x-3 bottom-6 text-center text-lg font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {textOverlay}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mx-auto flex aspect-[9/16] max-h-96 w-56 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm">{t("choosePhoto")}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              selectFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="story-text">{t("textOverlay")}</Label>
            <Input
              id="story-text"
              value={textOverlay}
              onChange={(event) => setTextOverlay(event.target.value)}
              maxLength={200}
              placeholder={t("textPlaceholder")}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!file || submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("share")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
