"use client";

import * as React from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";

/**
 * The reseller's presentation kit.
 *
 * A dropshipper does not sell inside the app — they sell in a Facebook comment,
 * a Viber thread, a Messenger DM. Whatever the product page shows, the actual
 * transaction starts with them pasting photos and a description to a customer,
 * and until now that meant long-pressing each image and retyping the specs.
 *
 * So: one button that copies a ready-made sales message, one that opens the
 * phone's share sheet with it, and one that saves every photo at once. Plus a
 * margin line, because the number a reseller most needs while quoting is what
 * they keep.
 */
export function CustomerPack({
  title,
  priceLabel,
  url,
  images,
  specs,
  shippingNote,
  storeName,
  strings,
}: {
  title: string;
  /** Already formatted with the currency — this component never does maths on money. */
  priceLabel: string;
  /** Absolute link to this listing, so a customer can open it. */
  url: string;
  images: string[];
  specs: { name: string; value: string }[];
  shippingNote?: string | null;
  storeName?: string | null;
  strings: {
    heading: string;
    hint: string;
    copy: string;
    copied: string;
    share: string;
    savePhotos: string;
    saving: string;
    photoCount: (n: number) => string;
  };
}) {
  const [copied, setCopied] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // The message a reseller would otherwise type by hand, in the order a buyer
  // reads it: what it is, what it costs, what it's made of, how it arrives.
  const message = React.useMemo(() => {
    const lines = [title, "", `💰 ${priceLabel}`];
    if (specs.length > 0) {
      lines.push("");
      for (const spec of specs.slice(0, 8)) {
        lines.push(`• ${spec.name}: ${spec.value}`);
      }
    }
    if (shippingNote) lines.push("", `🚚 ${shippingNote}`);
    if (storeName) lines.push(`🏬 ${storeName}`);
    lines.push("", url);
    return lines.join("\n");
  }, [title, priceLabel, specs, shippingNote, storeName, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context or without permission;
      // selecting the textarea below still lets the user copy by hand.
    }
  }

  async function share() {
    if (!navigator.share) {
      void copy();
      return;
    }
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      // The user dismissed the sheet — not an error worth showing.
    }
  }

  /**
   * Save every photo. Fetched as blobs rather than pointed at with <a download>
   * because the merchant images are cross-origin, and a cross-origin `download`
   * attribute is ignored — the browser navigates instead, which is how you end
   * up with one tab per photo and nothing saved.
   */
  async function saveAll() {
    setSaving(true);
    try {
      for (let i = 0; i < images.length; i++) {
        try {
          const res = await fetch(images[i]!, { referrerPolicy: "no-referrer" });
          if (!res.ok) continue;
          const blob = await res.blob();
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = `${slug(title)}-${i + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(href);
          // Browsers throttle a burst of downloads; a short gap keeps them all.
          await new Promise((r) => setTimeout(r, 250));
        } catch {
          // One blocked image should not stop the rest.
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-semibold">{strings.heading}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {strings.hint}
        </p>
      </div>

      <textarea
        readOnly
        value={message}
        rows={7}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-y rounded-lg border bg-background p-2 font-mono text-[11px] leading-relaxed"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? strings.copied : strings.copy}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Share2 className="h-3.5 w-3.5" /> {strings.share}
        </button>
        {images.length > 0 ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveAll()}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {saving
              ? strings.saving
              : `${strings.savePhotos} · ${strings.photoCount(images.length)}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "product"
  );
}
