"use client";

import * as React from "react";
import { Loader2, RotateCcw, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CAPTURES_TO_WIN,
  KYAR_N,
  KYAR_SEGMENTS,
  kyarFresh,
  kyarMovesFrom,
  kyarWinnerOf,
  type KyarMove,
  type KyarState,
} from "@/lib/games/kyar";
import { createClient } from "@/lib/data/client";
import { cn } from "@/lib/utils";

/**
 * ကျားထိုး — traditional Myanmar tigers-and-cattle board game in messenger.
 * Mutual-consent start (invite/accept), full state broadcast over the
 * per-conversation realtime channel, same pattern as the other games.
 */

const MARGIN = 26;
const STEP = 62;
const SIZE = MARGIN * 2 + STEP * (KYAR_N - 1);
const px = (i: number) => MARGIN + (i % KYAR_N) * STEP;
const py = (i: number) => MARGIN + Math.floor(i / KYAR_N) * STEP;

export function KyarGame({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const [state, setState] = React.useState<KyarState>(() => kyarFresh(null));
  const [selected, setSelected] = React.useState<number | null>(null);
  const [invitedBy, setInvitedBy] = React.useState<string | null>(null);
  const [awaiting, setAwaiting] = React.useState(false);
  const [declined, setDeclined] = React.useState(false);
  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    const db = createClient();
    const channel = db.channel(`game:${conversationId}:kyar`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "invite" }, (p) => {
        const from = (p.payload?.from as string) ?? null;
        if (from && from !== currentUserId) {
          setInvitedBy(from);
          setDeclined(false);
        }
      })
      .on("broadcast", { event: "accept" }, (p) => {
        const tiger = (p.payload?.tiger as string) ?? null;
        setState(kyarFresh(tiger));
        setSelected(null);
        setAwaiting(false);
        setInvitedBy(null);
      })
      .on("broadcast", { event: "decline" }, () => {
        setAwaiting(false);
        setDeclined(true);
      })
      .on("broadcast", { event: "state" }, (p) => {
        const next = p.payload?.state as KyarState | undefined;
        if (next) {
          setState(next);
          setSelected(null);
        }
      })
      .on("broadcast", { event: "sync-req" }, () => {
        const s = stateRef.current;
        if (s.tiger !== null) {
          void channel.send({
            type: "broadcast",
            event: "state",
            payload: { state: s },
          });
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({ type: "broadcast", event: "sync-req", payload: {} });
        }
      });
    chanRef.current = channel;
    return () => {
      chanRef.current = null;
      void db.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const mySide: "T" | "G" | null =
    state.tiger === null ? null : state.tiger === currentUserId ? "T" : "G";
  const result = kyarWinnerOf(state);
  const playing = state.tiger !== null && !result;
  const myTurn = playing && mySide !== null && mySide === state.turn;
  const placing = state.goatsLeft > 0;

  const legal: KyarMove[] =
    selected !== null && state.cells[selected] === mySide && !(mySide === "G" && placing)
      ? kyarMovesFrom(state.cells, selected)
      : [];

  function push(next: KyarState) {
    setState(next);
    setSelected(null);
    void chanRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next },
    });
  }

  function onPoint(i: number) {
    if (!myTurn) return;
    const cell = state.cells[i];

    // Cattle placement phase: tap any empty point.
    if (mySide === "G" && placing) {
      if (cell !== null) return;
      const cells = state.cells.slice();
      cells[i] = "G";
      push({ ...state, cells, goatsLeft: state.goatsLeft - 1, turn: "T" });
      return;
    }

    // Select own piece (cattle can only move once all are placed).
    if (cell === mySide) {
      setSelected(selected === i ? null : i);
      return;
    }

    // Move / jump to a legal target.
    if (selected !== null) {
      const mv = legal.find((m) => m.to === i);
      if (!mv) return;
      const cells = state.cells.slice();
      cells[i] = mySide;
      cells[selected] = null;
      let captured = state.captured;
      if (mv.jumped !== null) {
        cells[mv.jumped] = null;
        captured += 1;
      }
      push({
        ...state,
        cells,
        captured,
        turn: state.turn === "T" ? "G" : "T",
      });
    }
  }

  function invite() {
    setAwaiting(true);
    setDeclined(false);
    setInvitedBy(null);
    void chanRef.current?.send({
      type: "broadcast",
      event: "invite",
      payload: { from: currentUserId },
    });
  }

  function accept() {
    if (!invitedBy) return;
    // The inviter plays the tigers; the accepter plays the cattle.
    setState(kyarFresh(invitedBy));
    setSelected(null);
    setInvitedBy(null);
    setAwaiting(false);
    void chanRef.current?.send({
      type: "broadcast",
      event: "accept",
      payload: { tiger: invitedBy },
    });
  }

  function decline() {
    setInvitedBy(null);
    void chanRef.current?.send({ type: "broadcast", event: "decline", payload: {} });
  }

  const sideLabel = (s: "T" | "G") => (s === "T" ? "🐯 ကျား" : "🐮 နွား");
  const status = result
    ? `${sideLabel(result)} အနိုင်ရ! 🎉`
    : state.tiger === null
      ? "နှစ်ဦးသဘောတူမှ စတင်ပါ — ဖိတ်သူက ကျား၊ လက်ခံသူက နွား။"
      : mySide === null
        ? "ကြည့်ရှုနေသည်…"
        : `${myTurn ? "🟢 သင့်အလှည့်" : "⏳ တစ်ဖက်လူ့အလှည့်"} — သင် ${sideLabel(mySide)}${
            mySide === "G" && placing ? ` (ချရန် ${state.goatsLeft} ကောင်)` : ""
          }`;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{status}</p>

      {playing ? (
        <p className="text-center text-xs text-muted-foreground">
          ဖမ်းမိ {state.captured}/{CAPTURES_TO_WIN} ကောင် · ကွင်းပြင်ပ နွား{" "}
          {state.goatsLeft} ကောင်
        </p>
      ) : null}

      {invitedBy ? (
        <div className="mx-auto flex max-w-[300px] flex-wrap items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span>🐯 တစ်ဖက်လူက ကျားထိုး ကစားရန် ဖိတ်ခေါ်နေသည်</span>
          <Button size="sm" onClick={accept}>
            <Swords className="mr-1 h-4 w-4" /> လက်ခံမည်
          </Button>
          <Button size="sm" variant="ghost" onClick={decline}>
            ငြင်းမည်
          </Button>
        </div>
      ) : null}
      {awaiting ? (
        <p className="text-center text-xs text-muted-foreground">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          တစ်ဖက်လူ လက်ခံရန် စောင့်ဆိုင်းနေသည်…
        </p>
      ) : null}
      {declined ? (
        <p className="text-center text-xs text-destructive">
          တစ်ဖက်လူက ဖိတ်ခေါ်မှုကို ငြင်းပယ်လိုက်သည်။
        </p>
      ) : null}

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={cn(
          "mx-auto block w-full max-w-[320px] rounded-xl border bg-muted/30",
          !playing && "opacity-70",
        )}
        role="img"
        aria-label="ကျားထိုး ကစားကွက်"
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
        {state.cells.map((cell, i) => {
          const target = legal.find((m) => m.to === i);
          return (
            <g
              key={i}
              onClick={() => onPoint(i)}
              className={myTurn ? "cursor-pointer" : undefined}
            >
              <circle
                cx={px(i)}
                cy={py(i)}
                r={15}
                className={cn(
                  "fill-transparent",
                  selected === i && "fill-primary/20",
                  target && "fill-primary/10",
                )}
              />
              {target ? (
                <circle
                  cx={px(i)}
                  cy={py(i)}
                  r={5}
                  className={target.jumped !== null ? "fill-destructive" : "fill-primary"}
                />
              ) : null}
              {cell ? (
                <text
                  x={px(i)}
                  y={py(i) + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={cell === "T" ? 22 : 18}
                >
                  {cell === "T" ? "🐯" : "🐮"}
                </text>
              ) : (
                <circle cx={px(i)} cy={py(i)} r={3} className="fill-border" />
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex justify-center gap-2">
        {!playing ? (
          <Button size="sm" onClick={invite} disabled={awaiting}>
            <Swords className="mr-1 h-4 w-4" />
            {result ? "ထပ်ကစားရန် ဖိတ်မည်" : "ကစားရန် ဖိတ်ခေါ်မည်"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={invite} disabled={awaiting}>
            <RotateCcw className="mr-1 h-4 w-4" /> အသစ်
          </Button>
        )}
      </div>

      <details className="mx-auto max-w-[320px] text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">📜 စည်းမျဉ်း</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>ကျား ၄ ကောင်က ထောင့် ၄ နေရာမှ စတင်၊ နွားဘက်က တစ်လှည့် တစ်ကောင် စုစုပေါင်း ၂၀ ချသည်။</li>
          <li>နွားအားလုံး ချပြီးမှ နွားများ ရွှေ့နိုင်သည် — မျဉ်းတစ်လျှောက် ကပ်လျက် အလွတ်ကွက်သို့။</li>
          <li>ကျားက ကပ်လျက် နွားကို ကျော်ခုန်ပြီး ဖမ်းသည် (ကျော်ရာ ကွက်လွတ် ရှိရမည်)။</li>
          <li>ကျားက နွား {CAPTURES_TO_WIN} ကောင် ဖမ်းမိရင် နိုင်၊ နွားက ကျားအားလုံး မရွှေ့နိုင်အောင် ပိတ်မိရင် နိုင်သည်။</li>
        </ul>
      </details>
    </div>
  );
}
