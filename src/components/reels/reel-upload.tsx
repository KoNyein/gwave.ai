"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";

import { createReel } from "@/lib/actions/reels";
import { uploadMedia } from "@/lib/media";
import { Button } from "@/components/ui/button";

export function ReelUpload({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState("");
  const [original, setOriginal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setCaption("");
    setOriginal(false);
    setError(null);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadMedia(userId, file);
      if (uploaded.media_type !== "video") {
        throw new Error("ဗီဒီယို ဖိုင်သာ တင်လို့ရပါတယ်။");
      }
      const res = await createReel({
        video_path: uploaded.storage_path,
        caption: caption.trim() || null,
        original_confirmed: original,
      });
      if (!res.ok) throw new Error(res.error);
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "တင်၍ မရပါ။");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Upload className="mr-1 h-4 w-4" /> 🎬 Reel တင်ရန်
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">🎬 Reel အသစ် တင်ရန်</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="ပိတ်"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
        <Upload className="h-6 w-6" />
        {file ? (
          <span className="font-medium text-foreground">{file.name}</span>
        ) : (
          <span>ဗီဒီယို ရွေးရန် နှိပ်ပါ (မြင်ကွင်း ဒေါင်လိုက် အကောင်းဆုံး)</span>
        )}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="စာသား / caption (optional)"
        rows={2}
        maxLength={500}
        className="w-full resize-none rounded-lg border bg-background p-2 text-sm"
      />

      <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
        <input
          type="checkbox"
          checked={original}
          onChange={(e) => setOriginal(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          ဤ ဗီဒီယို/အသံကို <b>ကျွန်ုပ် ကိုယ်တိုင် ဖန်တီးထားပြီး</b> မူပိုင်ခွင့်
          ချိုးဖောက်မှု မရှိပါ။ အခြား platform / social network မည်သည့်နေရာတွင်မျှ
          <b> တင်ဖူးခြင်း မရှိသေးသော</b> မူရင်း content ဖြစ်ပါသည်။ (ဝင်ငွေ ရရှိရန်
          အတွက် လိုအပ်သည်)
        </span>
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button onClick={submit} disabled={!file || busy} className="w-full">
        {busy ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> တင်နေသည်…
          </>
        ) : original ? (
          "တင်မည် (💰 monetize)"
        ) : (
          "တင်မည်"
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        အများဆုံး ၁၀၀ MB · မူရင်း (original) content သာ ဝင်ငွေ ရရှိမည် 💰
      </p>
    </div>
  );
}
