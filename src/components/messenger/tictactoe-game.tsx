"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

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
  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`game:${conversationId}:ttt`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "new" }, (p) => setState(fresh(p.payload?.x ?? null)))
      .on("broadcast", { event: "mark" }, (p) => {
        const i = p.payload?.i as number;
        setState((s) => play(s, i));
      })
      .subscribe();
    chanRef.current = channel;
    return () => {
      chanRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const myMark: "X" | "O" | null =
    state.x === null ? null : state.x === currentUserId ? "X" : "O";
  const result = winnerOf(state.cells);
  const myTurn = myMark !== null && myMark === state.turn && !result;

  function play(s: State, i: number): State {
    if (s.cells[i] || winnerOf(s.cells)) return s;
    const cells = s.cells.slice();
    cells[i] = s.turn;
    return { ...s, cells, turn: s.turn === "X" ? "O" : "X" };
  }

  function onCell(i: number) {
    if (!myTurn || state.cells[i]) return;
    setState((s) => play(s, i));
    void chanRef.current?.send({ type: "broadcast", event: "mark", payload: { i } });
  }

  function newGame() {
    setState(fresh(currentUserId));
    void chanRef.current?.send({
      type: "broadcast",
      event: "new",
      payload: { x: currentUserId },
    });
  }

  const status = result
    ? result === "draw"
      ? "သရေ (Draw)"
      : `${result} အနိုင်ရ! 🎉`
    : state.x === null
      ? "New game နှိပ်ပြီး စတင်ပါ။"
      : myMark === null
        ? "ကြည့်ရှုနေသည်…"
        : `${myTurn ? "🟢 သင့်အလှည့်" : "⏳ တစ်ဖက်လူ့အလှည့်"} — သင် ${myMark}`;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{status}</p>
      <div className="mx-auto grid aspect-square w-full max-w-[280px] grid-cols-3 gap-1.5">
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
      <div className="flex justify-center">
        <Button size="sm" variant="outline" onClick={newGame}>
          <RotateCcw className="mr-1 h-4 w-4" /> New game
        </Button>
      </div>
    </div>
  );
}
