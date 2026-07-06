"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { submitPromptPayPayment } from "@/lib/actions/membership";
import { prepareMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

/** Uploads the transfer slip to the private bucket and submits for review. */
export function SlipUpload({
  userId,
  plan,
}: {
  userId: string;
  plan: "pro" | "business";
}) {
  const t = useTranslations("membership");
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const prepared = await prepareMedia(file);
      if (prepared.mediaType !== "image") {
        throw new Error(t("slipImageOnly"));
      }
      const path = `${userId}/${crypto.randomUUID()}.${prepared.extension}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("slips")
        .upload(path, prepared.blob, { contentType: prepared.contentType });
      if (uploadError) throw new Error(uploadError.message);

      const result = await submitPromptPayPayment({ plan, slipPath: path });
      if (!result.ok) throw new Error(result.error);

      setDone(true);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("slipUploadFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary bg-secondary p-4 text-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
        {t("slipSubmitted")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Upload className="h-6 w-6" />
        {file ? file.name : t("chooseSlip")}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!file || submitting}
      >
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t("submitSlip")}
      </Button>
    </div>
  );
}
