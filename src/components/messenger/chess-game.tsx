"use client";

import * as React from "react";
import { Flag, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  applyMove,
  colorOf,
  glyph,
  initialBoard,
  legalMoves,
  statusOf,
  type Board,
  type Color,
  type Sq,
} from "@/lib/chess/engine";
import { cn } from "@/lib/utils";

interface State {
  board: Board;
  turn: Color;
  white: string | null; // user id playing white
  over: string | null; // result text, or null while playing
}

function fresh(white: string | null): State {
  return { board: initialBoard(), turn: "w", white, over: null };
}

export function ChessGame({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const storeKey = `chess:${conversationId}`;
  const [state, setState] = React.useState<State>(() => fresh(null));
  const [sel, setSel] = React.useState<Sq | null>(null);
  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  // Restore a game in progress after a refresh.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setState(JSON.parse(raw) as State);
    } catch {
      /* ignore */
    }
  }, [storeKey]);

  React.useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [storeKey, state]);

  // Realtime sync with the opponent.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`game:${conversationId}:chess`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "new" }, (p) => {
        setState(fresh(p.payload?.white ?? null));
        setSel(null);
      })
      .on("broadcast", { event: "move" }, (p) => {
        const { from, to } = p.payload as { from: Sq; to: Sq };
        setState((s) => advance(s, from, to));
        setSel(null);
      })
      .on("broadcast", { event: "resign" }, (p) => {
        setState((s) => ({ ...s, over: `${p.payload?.byColor === "w" ? "⚪" : "⚫"} လက်လျှော့ — အနိုင်ရ!` }));
      })
      .subscribe();
    chanRef.current = channel;
    return () => {
      chanRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const myColor: Color | null =
    state.white === null
      ? null
      : state.white === currentUserId
        ? "w"
        : "b";
  const myTurn = myColor !== null && myColor === state.turn && !state.over;

  function advance(s: State, from: Sq, to: Sq): State {
    const board = applyMove(s.board, from, to);
    const turn: Color = s.turn === "w" ? "b" : "w";
    const st = statusOf(board, turn);
    let over: string | null = null;
    if (st === "checkmate") over = `${s.turn === "w" ? "⚪" : "⚫"} အနိုင်ရ! (Checkmate)`;
    else if (st === "stalemate") over = "သရေ (Stalemate)";
    return { ...s, board, turn, over };
  }

  function newGame() {
    const next = fresh(currentUserId);
    setState(next);
    setSel(null);
    void chanRef.current?.send({
      type: "broadcast",
      event: "new",
      payload: { white: currentUserId },
    });
  }

  function resign() {
    if (!myColor || state.over) return;
    setState((s) => ({ ...s, over: `${myColor === "w" ? "⚪" : "⚫"} လက်လျှော့` }));
    void chanRef.current?.send({
      type: "broadcast",
      event: "resign",
      payload: { byColor: myColor },
    });
  }

  const targets = sel ? legalMoves(state.board, sel, state.turn) : [];

  function onSquare(r: number, c: number) {
    if (!myTurn) return;
    const piece = state.board[r]?.[c] ?? null;
    if (sel) {
      if (targets.some((t) => t.r === r && t.c === c)) {
        const from = sel;
        setState((s) => advance(s, from, { r, c }));
        setSel(null);
        void chanRef.current?.send({
          type: "broadcast",
          event: "move",
          payload: { from, to: { r, c } },
        });
        return;
      }
      // Re-select own piece or clear.
      if (piece && colorOf(piece) === myColor) setSel({ r, c });
      else setSel(null);
      return;
    }
    if (piece && colorOf(piece) === myColor) setSel({ r, c });
  }

  // Render orientation: black sees the board flipped.
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const flip = myColor === "b";
  const rr = flip ? [...rows].reverse() : rows;
  const cc = flip ? [...rows].reverse() : rows;

  const statusText = state.over
    ? state.over
    : state.white === null
      ? "New game နှိပ်ပြီး စတင်ပါ။"
      : myColor === null
        ? "ကြည့်ရှုနေသည်…"
        : `${myTurn ? "🟢 သင့်အလှည့်" : "⏳ တစ်ဖက်လူ့အလှည့်"} — ${state.turn === "w" ? "⚪ White" : "⚫ Black"}`;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{statusText}</p>

      <div className="mx-auto grid aspect-square w-full max-w-[360px] grid-cols-8 overflow-hidden rounded-lg border">
        {rr.map((r) =>
          cc.map((c) => {
            const dark = (r + c) % 2 === 1;
            const piece = state.board[r]?.[c] ?? null;
            const isSel = sel?.r === r && sel?.c === c;
            const isTarget = targets.some((t) => t.r === r && t.c === c);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => onSquare(r, c)}
                className={cn(
                  "relative flex items-center justify-center text-2xl leading-none sm:text-3xl",
                  dark ? "bg-amber-800/40" : "bg-amber-100/70",
                  isSel && "ring-2 ring-inset ring-primary",
                )}
              >
                <span className={colorOf(piece) === "w" ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" : "text-black"}>
                  {glyph(piece)}
                </span>
                {isTarget ? (
                  <span className="absolute h-2.5 w-2.5 rounded-full bg-primary/70" />
                ) : null}
              </button>
            );
          }),
        )}
      </div>

      <div className="flex justify-center gap-2">
        <Button size="sm" variant="outline" onClick={newGame}>
          <RotateCcw className="mr-1 h-4 w-4" /> New game
        </Button>
        {myColor && !state.over ? (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={resign}>
            <Flag className="mr-1 h-4 w-4" /> လက်လျှော့
          </Button>
        ) : null}
      </div>
    </div>
  );
}
