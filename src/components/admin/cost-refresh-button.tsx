"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Force a fresh Cost Explorer read.
 *
 * Deliberately a button rather than an automatic refresh: each pull is four
 * billed API requests (~$0.04), so the confirm spells that out and the label
 * shows how old the cached figures are — a six-hour-old number is usually fine
 * and the user should be able to see that before spending anything.
 */
export function CostRefreshButton({ fetchedAt }: { fetchedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [age, setAge] = React.useState<string>("");

  // Rendered on the client only, so the server/client clocks can't disagree.
  React.useEffect(() => {
    const stamp = new Date(fetchedAt);
    const mins = Math.max(0, Math.round((Date.now() - stamp.getTime()) / 60000));
    setAge(
      mins < 1
        ? "ယခုပင်"
        : mins < 60
          ? `${mins} မိနစ်က`
          : `${Math.floor(mins / 60)} နာရီက`,
    );
  }, [fetchedAt]);

  async function refresh() {
    if (
      !window.confirm(
        "Cost Explorer ကို ပြန်ခေါ်မှာ သေချာလား? တစ်ကြိမ်လျှင် ခန့်မှန်း $0.04 ကျသင့်ပါမည်။",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/admin/aws-cost", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={busy}
        onClick={() => void refresh()}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        Refresh (≈$0.04)
      </button>
      {age ? (
        <p className="mt-1 text-[11px] text-muted-foreground">ရယူချိန်: {age}</p>
      ) : null}
    </div>
  );
}
