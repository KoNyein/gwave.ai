"use client";

import * as React from "react";
import { Flag, Loader2, RotateCcw, Swords } from "lucide-react";

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
  // Handshake: both players must agree before a game starts.
  const [invitedBy, setInvitedBy] = React.useState<string | null>(null);
  const [awaiting, setAwaiting] = React.useState(false);
  const [declined, setDeclined] = React.useState(false);
  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

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

  // Realtime sync with the opponent. Full-state broadcasts keep both boards
  // identical even if a single message is missed, so there is no drift.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`game:${conversationId}:chess`, {
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
        // Opponent accepted my invite — start with the agreed white player.
        const white = (p.payload?.white as string) ?? null;
        setState(fresh(white));
        setSel(null);
        setAwaiting(false);
        setInvitedBy(null);
      })
      .on("broadcast", { event: "decline" }, () => {
        setAwaiting(false);
        setDeclined(true);
      })
      .on("broadcast", { event: "state" }, (p) => {
        const next = p.payload?.state as State | undefined;
        if (next) {
          setState(next);
          setSel(null);
        }
      })
      .on("broadcast", { event: "sync-req" }, () => {
        // A player (re)opened the panel — send them the live board if a game
        // is in progress so they don't start from a stale/empty state.
        const s = stateRef.current;
        if (s.white !== null) {
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

  const myColor: Color | null =
    state.white === null
      ? null
      : state.white === currentUserId
        ? "w"
        : "b";
  const myTurn = myColor !== null && myColor === state.turn && !state.over;
  const playing = state.white !== null && !state.over;

  function advance(s: State, from: Sq, to: Sq): State {
    const board = applyMove(s.board, from, to);
    const turn: Color = s.turn === "w" ? "b" : "w";
    const st = statusOf(board, turn);
    let over: string | null = null;
    if (st === "checkmate") over = `${s.turn === "w" ? "⚪" : "⚫"} အနိုင်ရ! (Checkmate)`;
    else if (st === "stalemate") over = "သရေ (Stalemate)";
    return { ...s, board, turn, over };
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
    // The inviter plays white; I (the accepter) play black.
    const next = fresh(invitedBy);
    setState(next);
    setSel(null);
    setInvitedBy(null);
    setAwaiting(false);
    void chanRef.current?.send({
      type: "broadcast",
      event: "accept",
      payload: { white: invitedBy },
    });
  }

  function decline() {
    setInvitedBy(null);
    void chanRef.current?.send({ type: "broadcast", event: "decline", payload: {} });
  }

  function resign() {
    if (!myColor || state.over) return;
    const next: State = {
      ...state,
      over: `${myColor === "w" ? "⚪" : "⚫"} လက်လျှော့ — တစ်ဖက်လူ အနိုင်ရ!`,
    };
    setState(next);
    void chanRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next },
    });
  }

  const targets = sel ? legalMoves(state.board, sel, state.turn) : [];

  function onSquare(r: number, c: number) {
    if (!myTurn) return;
    const piece = state.board[r]?.[c] ?? null;
    if (sel) {
      if (targets.some((t) => t.r === r && t.c === c)) {
        const next = advance(state, sel, { r, c });
        setState(next);
        setSel(null);
        void chanRef.current?.send({
          type: "broadcast",
          event: "state",
          payload: { state: next },
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
      ? "နှစ်ဦးသဘောတူမှ စတင်ပါ။"
      : myColor === null
        ? "ကြည့်ရှုနေသည်…"
        : `${myTurn ? "🟢 သင့်အလှည့်" : "⏳ တစ်ဖက်လူ့အလှည့်"} — ${state.turn === "w" ? "⚪ White" : "⚫ Black"} (သင် ${myColor === "w" ? "⚪" : "⚫"})`;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{statusText}</p>

      {/* Invitation handshake — both players must agree to play. */}
      {invitedBy ? (
        <div className="mx-auto flex max-w-[360px] flex-wrap items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span>♟️ တစ်ဖက်လူက စစ်ကစားရန် ဖိတ်ခေါ်နေသည်</span>
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
          "mx-auto grid aspect-square w-full max-w-[360px] grid-cols-8 overflow-hidden rounded-lg border",
          !playing && "opacity-70",
        )}
      >
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
        {!playing ? (
          <Button size="sm" onClick={invite} disabled={awaiting}>
            <Swords className="mr-1 h-4 w-4" />
            {state.over ? "ထပ်ကစားရန် ဖိတ်မည်" : "ကစားရန် ဖိတ်ခေါ်မည်"}
          </Button>
        ) : null}
        {myColor && !state.over ? (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={resign}>
            <Flag className="mr-1 h-4 w-4" /> လက်လျှော့
          </Button>
        ) : null}
        {playing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={invite}
            disabled={awaiting}
            title="အသစ်ပြန်စ"
          >
            <RotateCcw className="mr-1 h-4 w-4" /> အသစ်
          </Button>
        ) : null}
      </div>
    </div>
  );
}
