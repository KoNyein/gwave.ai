"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminSettleWager } from "@/lib/actions/wagers";
import type { DisputedWager } from "@/lib/db/wagers";
import type { ChessWagerResult } from "@/types/database";

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

const RESULT_LABEL: Record<ChessWagerResult, string> = {
  host_win: "Host နိုင်",
  guest_win: "Guest နိုင်",
  draw: "သရေ",
};

/** One disputed wager with the three admin rulings. */
function DisputeRow({ wager }: { wager: DisputedWager }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function settle(result: ChessWagerResult) {
    const label = RESULT_LABEL[result];
    if (!window.confirm(`ဒီပွဲကို "${label}" အဖြစ် ဆုံးဖြတ်မှာ သေချာလား? ငွေ ချက်ချင်း ထုတ်ပေးပါမည်။`)) return;
    setError(null);
    startTransition(async () => {
      const res = await adminSettleWager(wager.id, result);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const host = wager.host_name ?? wager.host_id.slice(0, 8);
  const guest = wager.guest_name ?? wager.guest_id?.slice(0, 8) ?? "—";

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            ♟️ {host} vs {guest}
          </p>
          <p className="text-xs text-muted-foreground">
            လောင်းကြေး {mmk(wager.stake_mmk)} · အိုး {mmk(wager.pot_mmk)} ·{" "}
            {new Date(wager.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="text-right text-xs">
          <p>
            Host တင်ပြချက်:{" "}
            <span className="font-medium">
              {wager.host_result ? RESULT_LABEL[wager.host_result] : "—"}
            </span>
          </p>
          <p>
            Guest တင်ပြချက်:{" "}
            <span className="font-medium">
              {wager.guest_result ? RESULT_LABEL[wager.guest_result] : "—"}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(Object.keys(RESULT_LABEL) as ChessWagerResult[]).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={r === "draw" ? "outline" : "default"}
            disabled={pending}
            onClick={() => settle(r)}
          >
            {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {RESULT_LABEL[r]}
          </Button>
        ))}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

/** Admin panel: disputed chess wagers awaiting a ruling. */
export function WagerDisputes({ wagers }: { wagers: DisputedWager[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Scale className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">
          ♟️ Chess လောင်းကြေး — အငြင်းပွားမှုများ ({wagers.length})
        </h2>
      </div>
      {wagers.length === 0 ? (
        <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          ဖြေရှင်းရန် အငြင်းပွားမှု မရှိပါ ✅
        </p>
      ) : (
        wagers.map((w) => <DisputeRow key={w.id} wager={w} />)
      )}
    </section>
  );
}
