"use client";

import * as React from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "gwave-install-dismissed";

/**
 * A slim "Add gwave to your home screen" banner that appears once the
 * browser offers installation (Chrome/Android/TWA). Hidden after the user
 * installs or dismisses it, and never shown when already running as an
 * installed app.
 */
export function InstallPrompt() {
  const [evt, setEvt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    // Already installed / running standalone → never prompt.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setVisible(false);
    setEvt(null);
  }

  if (!visible) return null;

  return (
    <div
      data-no-print
      className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-2xl md:bottom-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Download className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">gwave app သွင်းမည်</p>
        <p className="text-xs text-muted-foreground">
          ဖုန်း home screen မှာ ထည့်ပြီး app လို အမြန် သုံးပါ
        </p>
      </div>
      <Button size="sm" onClick={install}>
        သွင်းမည်
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="ပိတ်"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
