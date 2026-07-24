"use client";

import * as React from "react";
import { CheckCircle2, LifeBuoy, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type Category = "purchase" | "playback" | "refund" | "other";

/**
 * In-app Help Center form for the audio store. Posts to /api/support/audio,
 * which records the ticket and triggers the n8n triage workflow. Shows the
 * ticket id on success (WCAG: clear confirmation, labelled controls).
 */
export function AudioHelpForm({ trackId }: { trackId?: string }) {
  const t = useTranslations("audio");
  const [category, setCategory] = React.useState<Category>("playback");
  const [busy, setBusy] = React.useState(false);
  const [ticket, setTicket] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const cats: { key: Category; label: string }[] = [
    { key: "purchase", label: t("catPurchase") },
    { key: "playback", label: t("catPlayback") },
    { key: "refund", label: t("catRefund") },
    { key: "other", label: t("catOther") },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = (new FormData(form).get("message") as string)?.trim() ?? "";
    if (message.length < 3) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/support/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, trackId }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && j.id) {
        setTicket(j.id);
        form.reset();
      } else {
        setErr(j.error ?? "error");
      }
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  if (ticket) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p>{t("supportSent", { id: ticket.slice(0, 8) })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <LifeBuoy className="h-4 w-4 text-primary" /> {t("helpContact")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              category === c.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        name="message"
        required
        rows={3}
        aria-label={t("supportMessage")}
        placeholder={t("supportMessage")}
        className="w-full rounded-md border border-input bg-background p-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {t("supportSend")}
        </Button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    </form>
  );
}
