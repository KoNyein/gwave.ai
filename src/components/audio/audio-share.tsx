"use client";

import * as React from "react";
import { Check, Copy, Nfc, QrCode, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Share a track: native Web Share, a scannable QR code (generated client-side
 * with the bundled `qrcode`), and — on supported phones (Chrome/Android) — an
 * NFC tag write. Each capability is feature-detected; unsupported ones simply
 * don't render, so it degrades gracefully everywhere.
 */
export function AudioShare({ title }: { title: string }) {
  const t = useTranslations("audio");
  const [url, setUrl] = React.useState("");
  const [qr, setQr] = React.useState<string | null>(null);
  const [showQr, setShowQr] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [nfcMsg, setNfcMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") setUrl(window.location.href);
  }, []);

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canNfc = typeof window !== "undefined" && "NDEFReader" in window;

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user cancelled */
    }
  }

  async function toggleQr() {
    if (!showQr && !qr) {
      try {
        const QR = (await import("qrcode")).default;
        setQr(await QR.toDataURL(url, { margin: 1, width: 240 }));
      } catch {
        /* qr generation failed */
      }
    }
    setShowQr((v) => !v);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function writeNfc() {
    setNfcMsg(null);
    try {
      const Ctor = (window as unknown as { NDEFReader: new () => { write: (m: unknown) => Promise<void> } })
        .NDEFReader;
      const reader = new Ctor();
      await reader.write({ records: [{ recordType: "url", data: url }] });
      setNfcMsg(t("nfcWritten"));
    } catch {
      setNfcMsg(t("nfcFailed"));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <Button variant="outline" size="sm" onClick={nativeShare}>
            <Share2 className="mr-1 h-4 w-4" /> {t("share")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={toggleQr} aria-expanded={showQr}>
          <QrCode className="mr-1 h-4 w-4" /> {t("qr")}
        </Button>
        {canNfc && (
          <Button variant="outline" size="sm" onClick={writeNfc}>
            <Nfc className="mr-1 h-4 w-4" /> {t("nfc")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={copyLink}>
          {copied ? (
            <Check className="mr-1 h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="mr-1 h-4 w-4" />
          )}
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>

      {showQr && qr && (
        <div className="inline-flex flex-col items-center gap-1 rounded-lg border border-border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t("qr")} width={200} height={200} />
          <span className="text-[11px] text-neutral-500">{t("qrHint")}</span>
        </div>
      )}
      {nfcMsg && <p className="text-xs text-muted-foreground">{nfcMsg}</p>}
    </div>
  );
}
