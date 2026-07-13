"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Loader2, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setStreamGameGoal } from "@/lib/actions/live";

/**
 * The game tag + support-goal progress bar shown on a game live stream (the
 * fundraising bar you see on TikTok/Bigo game streams). Viewers see the badge
 * and progress; the host gets an inline editor to set them.
 */
export function GameGoalBar({
  streamId,
  isHost,
  gameName,
  goalAmount,
  goalLabel,
  gifted,
}: {
  streamId: string;
  isHost: boolean;
  gameName: string | null;
  goalAmount: number | null;
  goalLabel: string | null;
  /** Total G-Pay gifted so far. */
  gifted: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [game, setGame] = React.useState(gameName ?? "");
  const [label, setLabel] = React.useState(goalLabel ?? "");
  const [amount, setAmount] = React.useState(goalAmount ? String(goalAmount) : "");
  const [pending, setPending] = React.useState(false);

  const percent =
    goalAmount && goalAmount > 0
      ? Math.min(100, Math.round((gifted / goalAmount) * 100))
      : null;

  async function save() {
    setPending(true);
    await setStreamGameGoal(streamId, {
      gameName: game,
      goalLabel: label,
      goalAmount: amount ? Number(amount) : undefined,
    });
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-3">
        <Input
          value={game}
          onChange={(e) => setGame(e.target.value)}
          placeholder="ဂိမ်းအမည် (ဥပမာ Minecraft)"
          maxLength={60}
        />
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Goal label (e.g. Dog food)"
            maxLength={80}
          />
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Goal (MMK)"
            inputMode="numeric"
            className="w-32"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void save()} disabled={pending}>
            {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            သိမ်း
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            ပယ်
          </Button>
        </div>
      </div>
    );
  }

  // Nothing set and not the host — render nothing.
  if (!gameName && percent === null && !isHost) return null;

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        {gameName ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <Gamepad2 className="h-4 w-4" /> {gameName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">ဂိမ်း Live</span>
        )}
        {isHost ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            တည်းဖြတ်
          </Button>
        ) : null}
      </div>

      {percent !== null ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Target className="h-3.5 w-3.5 text-primary" />
              {goalLabel ?? "Goal"}
            </span>
            <span className="text-muted-foreground">
              {Math.round(gifted).toLocaleString("en-US")} /{" "}
              {Math.round(goalAmount!).toLocaleString("en-US")} · {percent}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
