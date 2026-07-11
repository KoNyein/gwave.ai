"use client";

import * as React from "react";
import { Loader2, RotateCcw, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Cell = "X" | "O" | null;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(cells: Cell[]): Cell | "draw" | null {
  for (const [a, b, c] of LINES) {
    const v = cells[a!] ?? null;
    if (v && v === cells[b!] && v === cells[c!]) return v;
  }
  return cells.every(Boolean) ? "draw" : null;
}

interface State {
  cells: Cell[];
  turn: "X" | "O";
  x: string | null; // user id playing X
}

const fresh = (x: string | null): State => ({
  cells: Array<Cell>(9).fill(null),
  turn: "X",
  x,
});

export function TicTacToeGame({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const [state, setState] = React.useState<State>(() => fresh(null));
  // Handshake: both players must agree before a game starts.
  const [invitedBy, setInvitedBy] = React.useState<string | null>(null);
  const [awaiting, setAwaiting] = React.useState(false);
  const [declined, setDeclined] = React.useState(false);
  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`game:${conversationId}:ttt`, {
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
        const x = (p.payload?.x as string) ?? null;
        setState(fresh(x));
        setAwaiting(false);
        setInvitedBy(null);
      })
      .on("broadcast", { event: "decline" }, () => {
        setAwaiting(false);
        setDeclined(true);
      })
      .on("broadcast", { event: "state" }, (p) => {
        const next = p.payload?.state as State | undefined;
        if (next) setState(next);
      })
      .on("broadcast", { event: "sync-req" }, () => {
        const s = stateRef.current;
        if (s.x !== null) {
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
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const myMark: "X" | "O" | null =
    state.x === null ? null : state.x === currentUserId ? "X" : "O";
  const result = winnerOf(state.cells);
  const myTurn = myMark !== null && myMark === state.turn && !result;
  const playing = state.x !== null && !result;

  function play(s: State, i: number): State {
    if (s.cells[i] || winnerOf(s.cells)) return s;
    const cells = s.cells.slice();
    cells[i] = s.turn;
    return { ...s, cells, turn: s.turn === "X" ? "O" : "X" };
  }

  function onCell(i: number) {
    if (!myTurn || state.cells[i]) return;
    const next = play(state, i);
    setState(next);
    void chanRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next },
    });
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
    // The inviter plays X; I (the accepter) play O.
    setState(fresh(invitedBy));
    setInvitedBy(null);
    setAwaiting(false);
    void chanRef.current?.send({
      type: "broadcast",
      event: "accept",
      payload: { x: invitedBy },
    });
  }

  function decline() {
    setInvitedBy(null);
    void chanRef.current?.send({ type: "broadcast", event: "decline", payload: {} });
  }

  const status = result
    ? result === "draw"
      ? "သရေ (Draw)"
      : `${result} အနိုင်ရ! 🎉`
    : state.x === null
      ? "နှစ်ဦးသဘောတူမှ စတင်ပါ။"
      : myMark === null
        ? "ကြည့်ရှုနေသည်…"
        : `${myTurn ? "🟢 သင့်အလှည့်" : "⏳ တစ်ဖက်လူ့အလှည့်"} — သင် ${myMark}`;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{status}</p>

      {invitedBy ? (
        <div className="mx-auto flex max-w-[280px] flex-wrap items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span>❌⭕ တစ်ဖက်လူက ကစားရန် ဖိတ်ခေါ်နေသည်</span>
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

      <div
        className={cn(
          "mx-auto grid aspect-square w-full max-w-[280px] grid-cols-3 gap-1.5",
          !playing && "opacity-70",
        )}
      >
        {state.cells.map((cell, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onCell(i)}
            className={cn(
              "flex items-center justify-center rounded-lg border bg-muted/40 text-4xl font-bold",
              cell === "X" && "text-primary",
              cell === "O" && "text-accent",
            )}
          >
            {cell}
          </button>
        ))}
      </div>

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
    </div>
  );
}
