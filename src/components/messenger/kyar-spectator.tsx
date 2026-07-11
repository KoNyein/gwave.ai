"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Radio } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { recordWagerView } from "@/lib/actions/wagers";
import {
  CAPTURES_TO_WIN,
  KYAR_N,
  KYAR_SEGMENTS,
  kyarFresh,
  kyarWinnerOf,
  type KyarState,
} from "@/lib/games/kyar";
import { createClient } from "@/lib/supabase/client";

const MARGIN = 26;
const STEP = 62;
const SIZE = MARGIN * 2 + STEP * (KYAR_N - 1);
const px = (i: number) => MARGIN + (i % KYAR_N) * STEP;
const py = (i: number) => MARGIN + Math.floor(i / KYAR_N) * STEP;

/**
 * Read-only live view of a wagered ကျားထိုး match. Subscribes to the same
 * public `wager:{id}` broadcast channel the players mirror the board to,
 * and counts a spectator view (credits the host if they're monetized).
 */
export function KyarSpectator({
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
  const [state, setState] = React.useState<KyarState>(() => kyarFresh(null));
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    void recordWagerView(wagerId);

    const supabase = createClient();
    const channel = supabase.channel(`wager:${wagerId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "state" }, (p) => {
        const next = p.payload?.state as KyarState | undefined;
        if (next) setState(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void channel.send({ type: "broadcast", event: "sync-req", payload: {} });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [wagerId]);

  const result = kyarWinnerOf(state);

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
              <Radio className="h-3 w-3" /> LIVE · 🐯 ကျားထိုး
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Coins className="h-4 w-4 text-amber-600" />
              {potMmk.toLocaleString("en-US")} ကျပ်
            </span>
          </div>

          <div className="flex items-center justify-between text-sm font-medium">
            <span className="truncate">🐯 {hostName}</span>
            <span className="truncate text-right">{guestName} 🐮</span>
          </div>

          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto block w-full max-w-[360px] rounded-xl border bg-muted/30"
            role="img"
            aria-label="ကျားထိုး ကစားကွက် (ကြည့်ရှုရန်)"
          >
            {KYAR_SEGMENTS.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={px(a)}
                y1={py(a)}
                x2={px(b)}
                y2={py(b)}
                className="stroke-border"
                strokeWidth={1.5}
              />
            ))}
            {state.cells.map((cell, i) =>
              cell ? (
                <text
                  key={i}
                  x={px(i)}
                  y={py(i) + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={cell === "T" ? 22 : 18}
                >
                  {cell === "T" ? "🐯" : "🐮"}
                </text>
              ) : (
                <circle key={i} cx={px(i)} cy={py(i)} r={3} className="fill-border" />
              ),
            )}
          </svg>

          <p className="text-center text-sm text-muted-foreground">
            {result
              ? `${result === "T" ? "🐯 ကျား" : "🐮 နွား"} အနိုင်ရ! 🎉`
              : !connected
                ? "ချိတ်ဆက်နေသည်…"
                : state.turn === "T"
                  ? "🐯 ကျား အလှည့်"
                  : "🐮 နွား အလှည့်"}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            ဖမ်းမိ {state.captured}/{CAPTURES_TO_WIN} · ထိုးငွေ{" "}
            {stakeMmk.toLocaleString("en-US")} ကျပ်စီ · ကြည့်ရှုသူများ host အတွက်
            monetization ဖြစ်စေသည်
          </p>
        </CardContent>
      </Card>
    </>
  );
}
