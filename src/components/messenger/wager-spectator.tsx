"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Radio } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { recordWagerView } from "@/lib/actions/wagers";
import { createClient } from "@/lib/supabase/client";
import {
  colorOf,
  glyph,
  initialBoard,
  type Board,
  type Color,
} from "@/lib/chess/engine";
import { cn } from "@/lib/utils";

interface State {
  board: Board;
  turn: Color;
  over: string | null;
}

/**
 * Read-only live view of a wagered chess match. Subscribes to the public
 * `wager:{id}` broadcast channel the players mirror their board to, and counts
 * a spectator view (which credits the host if they're monetized).
 */
export function WagerSpectator({
  wagerId,
  potMmk,
  stakeMmk,
  hostName,
  guestName,
}: {
  wagerId: string;
  potMmk: number;
  stakeMmk: number;
  hostName: string;
  guestName: string;
}) {
  const [state, setState] = React.useState<State>(() => ({
    board: initialBoard(),
    turn: "w",
    over: null,
  }));
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    // Count this spectator once (server dedups + monetizes).
    void recordWagerView(wagerId);

    const supabase = createClient();
    const channel = supabase.channel(`wager:${wagerId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "state" }, (p) => {
        const next = p.payload?.state as State | undefined;
        if (next) setState(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          // Nudge a player to resend the current board to late joiners.
          void channel.send({ type: "broadcast", event: "sync-req", payload: {} });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [wagerId]);

  const rows = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <>
      <Link
        href="/arena"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Live Arena
      </Link>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-2 py-0.5 font-semibold text-red-600">
              <Radio className="h-3 w-3" /> LIVE
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Coins className="h-4 w-4 text-amber-600" />
              {potMmk.toLocaleString("en-US")} ကျပ်
            </span>
          </div>

          <div className="flex items-center justify-between text-sm font-medium">
            <span className="truncate">⚪ {hostName}</span>
            <span className="truncate text-right">{guestName} ⚫</span>
          </div>

          <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border">
            {rows.map((r) =>
              rows.map((c) => {
                const dark = (r + c) % 2 === 1;
                const piece = state.board[r]?.[c] ?? null;
                return (
                  <div
                    key={`${r}-${c}`}
                    className={cn(
                      "flex items-center justify-center text-2xl leading-none sm:text-3xl",
                      dark ? "bg-amber-800/40" : "bg-amber-100/70",
                    )}
                  >
                    <span
                      className={
                        colorOf(piece) === "w"
                          ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                          : "text-black"
                      }
                    >
                      {glyph(piece)}
                    </span>
                  </div>
                );
              }),
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {state.over
              ? state.over
              : !connected
                ? "ချိတ်ဆက်နေသည်…"
                : state.turn === "w"
                  ? "⚪ White အလှည့်"
                  : "⚫ Black အလှည့်"}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            ထိုးငွေ {stakeMmk.toLocaleString("en-US")} ကျပ်စီ · ကြည့်ရှုသူများ host အတွက် monetization ဖြစ်စေသည်
          </p>
        </CardContent>
      </Card>
    </>
  );
}
