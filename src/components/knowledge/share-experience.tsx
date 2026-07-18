"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, Check, Loader2, Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPost } from "@/lib/actions/posts";
import { uploadMedia, type UploadedMedia } from "@/lib/media";

const MAX_PHOTOS = 4;

interface Selected {
  file: File;
  preview: string;
}

/**
 * "Share your experience" box for knowledge pages (strains, minerals). Posts
 * the text + photos to the public news feed with a link back to the item, so
 * experiences are shared where everyone already reads: the feed.
 */
export function ShareExperience({
  userId,
  itemName,
  itemPath,
}: {
  /** Current user's profiles.id, or null when signed out (renders a login hint). */
  userId: string | null;
  itemName: string;
  itemPath: string;
}) {
  const [text, setText] = React.useState("");
  const [selected, setSelected] = React.useState<Selected[]>([]);
  const [pending, setPending] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(
    () => () => selected.forEach((s) => URL.revokeObjectURL(s.preview)),
    [selected],
  );

  if (!userId) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          🤝 အတွေ့အကြုံ share လုပ်ဖို့{" "}
          <Link href="/login" className="font-medium text-primary underline">
            Login ဝင်ပါ
          </Link>
        </CardContent>
      </Card>
    );
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setSelected((prev) =>
      [
        ...prev,
        ...images.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ].slice(0, MAX_PHOTOS),
    );
  }

  function removeAt(index: number) {
    setSelected((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  }

  async function share() {
    if (pending) return;
    if (text.trim().length === 0 && selected.length === 0) {
      setError("စာရေးပါ သို့မဟုတ် ဓာတ်ပုံရွေးပါ");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const media: UploadedMedia[] = [];
      for (const item of selected) {
        media.push(await uploadMedia(userId as string, item.file));
      }
      const content = [
        text.trim(),
        `📌 ${itemName} — https://gwave.cc${itemPath}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const result = await createPost({
        content,
        visibility: "public",
        media,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShared(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload မအောင်မြင်ပါ — ပြန်စမ်းကြည့်ပါ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-1.5 font-semibold">
          🤝 အတွေ့အကြုံ share လုပ်ရန်
        </p>
        {shared ? (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Check className="h-4 w-4" /> Share ပြီးပါပြီ —{" "}
            <Link href="/feed" className="font-medium underline">
              News Feed မှာကြည့်ရန်
            </Link>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={`${itemName} နဲ့ပတ်သက်တဲ့ သင့်အတွေ့အကြုံကို ရေးပါ…`}
              className="w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selected.map((item, index) => (
                  <div key={item.preview} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt=""
                      className="h-20 w-20 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      aria-label="ဖယ်ရန်"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={pending || selected.length >= MAX_PHOTOS}
              >
                <Camera className="mr-1.5 h-4 w-4" /> ဓာတ်ပုံ (
                {selected.length}/{MAX_PHOTOS})
              </Button>
              <Button type="button" size="sm" onClick={share} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-1.5 h-4 w-4" />
                )}
                Post အဖြစ် Share မယ်
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share လုပ်တာနဲ့ News Feed မှာ public post အဖြစ် ပေါ်ပါမယ်။
            </p>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
