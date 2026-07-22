"use client";

import * as React from "react";
import {
  Flag,
  Handshake,
  RotateCcw,
  RefreshCw,
  Swords,
  Undo2,
} from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/data/client";
import {
  applyMove,
  colorOf,
  glyph,
  inCheck,
  initialBoard,
  kingSquare,
  legalMoves,
  statusOf,
  typeOf,
  type Board,
  type Color,
  type Piece,
  type PieceType,
  type Sq,
} from "@/lib/chess/engine";
import { cn } from "@/lib/utils";
import type { AuthorSummary } from "@/types/social";

/** Time controls offered at invite. `null` = no clock. */
const TIME_CONTROLS = [
  { label: "5 min", ms: 5 * 60_000 },
  { label: "10 min", ms: 10 * 60_000 },
  { label: "အချိန်မဲ့", ms: null },
] as const;

interface Move {
  from: Sq;
  to: Sq;
  piece: Exclude<Piece, null>;
  captured: Piece;
  san: string;
}

interface State {
  board: Board;
  turn: Color;
  /** User id playing white (the inviter). null = no game yet. */
  white: string | null;
  over: string | null;
  winner: Color | "draw" | null;
  history: Move[];
  /** Board before each move, so a takeback can rewind exactly. */
  past: Board[];
  /** Milliseconds left on each clock, as of `turnStartedAt`. null = no clock. */
  clock: { w: number; b: number } | null;
  turnStartedAt: number | null;
}

function fresh(white: string | null, clockMs: number | null): State {
  return {
    board: initialBoard(),
    turn: "w",
    white,
    over: null,
    winner: null,
    history: [],
    past: [],
    clock: clockMs === null ? null : { w: clockMs, b: clockMs },
    turnStartedAt: clockMs === null ? null : Date.now(),
  };
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
/** Rows are top-down (row 0 = rank 8), which is how the engine stores them. */
function square(sq: Sq): string {
  return `${FILES[sq.c] ?? "?"}${8 - sq.r}`;
}

const LETTER: Record<PieceType, string> = {
  P: "",
  N: "N",
  B: "B",
  R: "R",
  Q: "Q",
  K: "K",
};

/** Piece values, for the captured-material advantage. */
const VALUE: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A short click for a move, a lower thud for a capture. No audio assets. */
function playMoveSound(capture: boolean): void {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = capture ? 180 : 420;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    window.setTimeout(() => void ctx.close().catch(() => {}), 300);
  } catch {
    // Audio is a nicety, never a failure.
  }
}

/** Android's own feedback channel — a real native touch on a phone. */
function haptic(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

/**
 * Two-player messenger chess, styled as an Android (Material 3) game surface:
 * player rails with avatars and a running chess clock, an elevated board with
 * last-move and check highlights, a captured-material tray, a move list, and
 * takeback / draw / rematch offers — all synced over the conversation's
 * realtime channel.
 */
export function ChessGame({
  conversationId,
  currentUserId,
  peer,
}: {
  conversationId: string;
  currentUserId: string;
  peer?: AuthorSummary | null;
}) {
  const storeKey = `chess:${conversationId}`;
  const [state, setState] = React.useState<State>(() => fresh(null, null));
  const [sel, setSel] = React.useState<Sq | null>(null);
  const [invitedBy, setInvitedBy] = React.useState<string | null>(null);
  const [awaiting, setAwaiting] = React.useState(false);
  const [declined, setDeclined] = React.useState(false);
  const [timeControl, setTimeControl] = React.useState<number | null>(
    10 * 60_000,
  );
  const [flipped, setFlipped] = React.useState(false);
  const [undoAsk, setUndoAsk] = React.useState(false);
  const [drawAsk, setDrawAsk] = React.useState(false);
  const [pendingPromo, setPendingPromo] = React.useState<{
    from: Sq;
    to: Sq;
  } | null>(null);
  /** Re-render once a second so the clock ticks. */
  const [, tick] = React.useState(0);

  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<State>;
      // An older save (before history/clock existed) would blow up the board.
      if (Array.isArray(parsed.board)) {
        setState({ ...fresh(parsed.white ?? null, null), ...parsed } as State);
      }
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

  const broadcast = React.useCallback((event: string, payload: object) => {
    void chanRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const push = React.useCallback(
    (next: State) => {
      setState(next);
      broadcast("state", { state: next });
    },
    [broadcast],
  );

  // Realtime sync with the opponent.
  React.useEffect(() => {
    const db = createClient();
    const channel = db.channel(`game:${conversationId}:chess`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "invite" }, (p) => {
        const from = (p.payload?.from as string) ?? null;
        if (from && from !== currentUserId) {
          setInvitedBy(from);
          setDeclined(false);
          haptic(30);
        }
      })
      .on("broadcast", { event: "accept" }, (p) => {
        const white = (p.payload?.white as string) ?? null;
        const ms = (p.payload?.clockMs as number | null) ?? null;
        setState(fresh(white, ms));
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
        if (!next) return;
        const prev = stateRef.current;
        setState(next);
        setSel(null);
        setUndoAsk(false);
        setDrawAsk(false);
        if (next.history.length > prev.history.length) {
          const last = next.history[next.history.length - 1];
          playMoveSound(Boolean(last?.captured));
          haptic(last?.captured ? [12, 40, 12] : 12);
        }
      })
      .on("broadcast", { event: "undo-req" }, () => setUndoAsk(true))
      .on("broadcast", { event: "draw-req" }, () => setDrawAsk(true))
      .on("broadcast", { event: "sync-req" }, () => {
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
          void channel.send({
            type: "broadcast",
            event: "sync-req",
            payload: {},
          });
        }
      });
    chanRef.current = channel;
    return () => {
      chanRef.current = null;
      void db.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const myColor: Color | null =
    state.white === null ? null : state.white === currentUserId ? "w" : "b";
  const myTurn = myColor !== null && myColor === state.turn && !state.over;
  const playing = state.white !== null && !state.over;

  /** Milliseconds left, counting the time the side to move has been thinking. */
  const remaining = React.useCallback(
    (color: Color): number | null => {
      if (!state.clock) return null;
      const base = state.clock[color];
      if (!playing || state.turn !== color || state.turnStartedAt === null) {
        return base;
      }
      return base - (Date.now() - state.turnStartedAt);
    },
    [state, playing],
  );

  // Tick the clock, and flag the loser when it runs out.
  React.useEffect(() => {
    if (!playing || !state.clock) return;
    const timer = window.setInterval(() => {
      tick((n) => n + 1);
      const left = remaining(state.turn);
      // Only the player whose flag fell announces it, so both sides agree.
      if (left !== null && left <= 0 && myColor === state.turn) {
        const loser = state.turn;
        push({
          ...state,
          clock: { ...state.clock!, [loser]: 0 },
          over: `⏱ အချိန်ကုန် — ${loser === "w" ? "⚫ Black" : "⚪ White"} အနိုင်ရ!`,
          winner: loser === "w" ? "b" : "w",
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, state, remaining, myColor, push]);

  /** Build the next state for a completed move (promotion already resolved). */
  function advance(s: State, from: Sq, to: Sq, promoteTo?: PieceType): State {
    const moving = s.board[from.r]?.[from.c] ?? null;
    const captured = s.board[to.r]?.[to.c] ?? null;
    if (!moving) return s;

    const board = applyMove(s.board, from, to);
    if (promoteTo) {
      const row = board[to.r];
      if (row) row[to.c] = `${s.turn}${promoteTo}` as Exclude<Piece, null>;
    }

    const turn: Color = s.turn === "w" ? "b" : "w";
    const st = statusOf(board, turn);

    const type = typeOf(moving) ?? "P";
    const suffix =
      st === "checkmate" ? "#" : st === "check" ? "+" : "";
    const san =
      `${LETTER[type]}${captured ? (type === "P" ? `${FILES[from.c] ?? ""}x` : "x") : ""}` +
      `${square(to)}${promoteTo ? `=${promoteTo}` : ""}${suffix}`;

    let over: string | null = null;
    let winner: Color | "draw" | null = null;
    if (st === "checkmate") {
      over = `${s.turn === "w" ? "⚪ White" : "⚫ Black"} အနိုင်ရ! (Checkmate)`;
      winner = s.turn;
    } else if (st === "stalemate") {
      over = "သရေ (Stalemate)";
      winner = "draw";
    }

    // Charge the mover's clock and hand the turn over.
    let clock = s.clock;
    if (clock && s.turnStartedAt !== null) {
      const spent = Date.now() - s.turnStartedAt;
      clock = { ...clock, [s.turn]: Math.max(0, clock[s.turn] - spent) };
    }

    return {
      ...s,
      board,
      turn,
      over,
      winner,
      history: [...s.history, { from, to, piece: moving, captured, san }],
      past: [...s.past, s.board],
      clock,
      turnStartedAt: clock ? Date.now() : null,
    };
  }

  function commit(from: Sq, to: Sq, promoteTo?: PieceType) {
    const next = advance(state, from, to, promoteTo);
    setSel(null);
    setPendingPromo(null);
    playMoveSound(Boolean(state.board[to.r]?.[to.c]));
    haptic(state.board[to.r]?.[to.c] ? [12, 40, 12] : 12);
    push(next);
  }

  function invite() {
    setAwaiting(true);
    setDeclined(false);
    setInvitedBy(null);
    broadcast("invite", { from: currentUserId });
  }

  function accept() {
    if (!invitedBy) return;
    const next = fresh(invitedBy, timeControl);
    setState(next);
    setSel(null);
    setInvitedBy(null);
    setAwaiting(false);
    broadcast("accept", { white: invitedBy, clockMs: timeControl });
  }

  function decline() {
    setInvitedBy(null);
    broadcast("decline", {});
  }

  function resign() {
    if (!myColor || state.over) return;
    push({
      ...state,
      over: `🏳️ ${myColor === "w" ? "⚪ White" : "⚫ Black"} လက်လျှော့ — တစ်ဖက်လူ အနိုင်ရ!`,
      winner: myColor === "w" ? "b" : "w",
    });
  }

  /** Rewind one full move each side, so the asker gets their move back. */
  function applyUndo() {
    const back = Math.min(2, state.past.length);
    if (back === 0) return;
    const board = state.past[state.past.length - back];
    if (!board) return;
    push({
      ...state,
      board,
      turn: back === 2 ? state.turn : state.turn === "w" ? "b" : "w",
      history: state.history.slice(0, -back),
      past: state.past.slice(0, -back),
      turnStartedAt: state.clock ? Date.now() : null,
    });
    setUndoAsk(false);
  }

  function agreeDraw() {
    push({ ...state, over: "🤝 သဘောတူ သရေ", winner: "draw" });
    setDrawAsk(false);
  }

  const targets = sel ? legalMoves(state.board, sel, state.turn) : [];

  function onSquare(r: number, c: number) {
    if (!myTurn) return;
    const piece = state.board[r]?.[c] ?? null;

    if (sel) {
      if (targets.some((t) => t.r === r && t.c === c)) {
        const moving = state.board[sel.r]?.[sel.c] ?? null;
        const isPromotion =
          typeOf(moving) === "P" && (r === 0 || r === 7);
        if (isPromotion) {
          setPendingPromo({ from: sel, to: { r, c } });
          return;
        }
        commit(sel, { r, c });
        return;
      }
      if (piece && colorOf(piece) === myColor) setSel({ r, c });
      else setSel(null);
      return;
    }
    if (piece && colorOf(piece) === myColor) setSel({ r, c });
  }

  // ── Derived view data ────────────────────────────────────────────────────
  const last = state.history[state.history.length - 1] ?? null;
  const checked: Color | null = playing
    ? inCheck(state.board, state.turn)
      ? state.turn
      : null
    : null;
  const checkedKing = checked ? kingSquare(state.board, checked) : null;

  const captured = { w: [] as PieceType[], b: [] as PieceType[] };
  for (const move of state.history) {
    const taken = move.captured;
    const type = typeOf(taken);
    const owner = colorOf(taken);
    if (type && owner) captured[owner].push(type);
  }
  const score = (color: Color) =>
    captured[color === "w" ? "b" : "w"].reduce((sum, t) => sum + VALUE[t], 0);
  const advantage = score("w") - score("b");

  // Board orientation: your own colour sits at the bottom, the way you'd sit at
  // the board. The flip button inverts that.
  const naturalWhiteBottom = myColor !== "b";
  const bottomIsWhite = flipped ? !naturalWhiteBottom : naturalWhiteBottom;
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  const rr = bottomIsWhite ? order : [...order].reverse();
  const cc = bottomIsWhite ? order : [...order].reverse();

  const statusText = state.over
    ? state.over
    : state.white === null
      ? "နှစ်ဦး သဘောတူမှ စတင်ပါ"
      : myColor === null
        ? "ကြည့်ရှုနေသည်…"
        : checked === myColor
          ? "⚠️ ချက် — ဘုရင် အန္တရာယ်!"
          : myTurn
            ? "🟢 သင့်အလှည့်"
            : "⏳ တစ်ဖက်လူ့အလှည့်";

  const opponentName = peer ? displayName(peer) : "တစ်ဖက်လူ";

  /**
   * One player's rail: avatar, name, captured tray and clock. Which colour sits
   * on which rail follows the board's orientation, so flipping moves both.
   */
  function Rail({ side }: { side: "top" | "bottom" }) {
    const color: Color =
      side === "bottom"
        ? bottomIsWhite
          ? "w"
          : "b"
        : bottomIsWhite
          ? "b"
          : "w";
    const mine = myColor === color;
    const ms = remaining(color);
    const active = playing && state.turn === color;
    const taken = captured[color === "w" ? "b" : "w"];
    const diff = color === "w" ? advantage : -advantage;

    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors",
          active ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "bg-muted/50",
        )}
      >
        {mine || !peer ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
              color === "w" ? "bg-white text-black" : "bg-neutral-900 text-white",
            )}
          >
            {color === "w" ? "♔" : "♚"}
          </span>
        ) : (
          <UserAvatar profile={peer} linked={false} className="h-8 w-8" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {mine ? "သင်" : opponentName}
            {color ? (
              <span className="ml-1 text-muted-foreground">
                {color === "w" ? "⚪" : "⚫"}
              </span>
            ) : null}
          </p>
          <p className="flex min-h-4 items-center gap-0.5 text-[13px] leading-none">
            {taken.map((t, i) => (
              <span key={i} className="opacity-70">
                {glyph(`${color === "w" ? "b" : "w"}${t}` as Exclude<Piece, null>)}
              </span>
            ))}
            {diff > 0 ? (
              <span className="ml-1 text-[10px] font-bold text-primary">
                +{diff}
              </span>
            ) : null}
          </p>
        </div>

        {ms !== null ? (
          <span
            className={cn(
              "shrink-0 rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums",
              active
                ? ms < 30_000
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-background shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {formatClock(ms)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[380px] space-y-2">
      <Rail side="top" />

      {/* Board */}
      <div className="relative">
        <div
          className={cn(
            "grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/10",
            !playing && "opacity-70",
          )}
        >
          {rr.map((r) =>
            cc.map((c) => {
              const dark = (r + c) % 2 === 1;
              const piece = state.board[r]?.[c] ?? null;
              const isSel = sel?.r === r && sel?.c === c;
              const isTarget = targets.some((t) => t.r === r && t.c === c);
              const isLast =
                last !== null &&
                ((last.from.r === r && last.from.c === c) ||
                  (last.to.r === r && last.to.c === c));
              const isCheck =
                checkedKing?.r === r && checkedKing?.c === c;
              const edgeFile = bottomIsWhite ? r === 7 : r === 0;
              const edgeRank = bottomIsWhite ? c === 0 : c === 7;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => onSquare(r, c)}
                  className={cn(
                    "relative flex items-center justify-center text-[26px] leading-none transition-transform active:scale-95 sm:text-[32px]",
                    dark ? "bg-[#769656]" : "bg-[#eeeed2]",
                    isLast && "after:absolute after:inset-0 after:bg-yellow-300/35",
                    isSel && "z-10 ring-[3px] ring-inset ring-primary",
                    isCheck &&
                      "animate-pulse bg-red-500/70 ring-2 ring-inset ring-red-700",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 select-none",
                      colorOf(piece) === "w"
                        ? "text-white drop-shadow-[0_1.5px_1px_rgba(0,0,0,0.55)]"
                        : "text-neutral-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]",
                    )}
                  >
                    {glyph(piece)}
                  </span>

                  {isTarget ? (
                    piece ? (
                      <span className="absolute inset-1 z-10 rounded-full ring-[3px] ring-primary/80" />
                    ) : (
                      <span className="absolute z-10 h-3 w-3 rounded-full bg-primary/60" />
                    )
                  ) : null}

                  {/* Coordinates, the way a real board is labelled. */}
                  {edgeRank ? (
                    <span
                      className={cn(
                        "absolute left-0.5 top-0 z-10 text-[8px] font-bold",
                        dark ? "text-[#eeeed2]" : "text-[#769656]",
                      )}
                    >
                      {8 - r}
                    </span>
                  ) : null}
                  {edgeFile ? (
                    <span
                      className={cn(
                        "absolute bottom-0 right-0.5 z-10 text-[8px] font-bold",
                        dark ? "text-[#eeeed2]" : "text-[#769656]",
                      )}
                    >
                      {FILES[c]}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {/* Promotion sheet — Material bottom-sheet style, over the board. */}
        {pendingPromo ? (
          <div className="absolute inset-0 z-20 flex items-end justify-center rounded-2xl bg-black/50 p-3">
            <div className="w-full rounded-2xl bg-card p-3 shadow-2xl">
              <p className="mb-2 text-center text-xs font-semibold">
                👑 ဘာအဖြစ် ပြောင်းမလဲ?
              </p>
              <div className="flex justify-center gap-2">
                {(["Q", "R", "B", "N"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      commit(pendingPromo.from, pendingPromo.to, t)
                    }
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl transition-transform active:scale-90 hover:bg-primary/15"
                  >
                    {glyph(`${state.turn}${t}` as Exclude<Piece, null>)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Rail side="bottom" />

      {/* Status chip */}
      <p
        className={cn(
          "mx-auto w-fit rounded-full px-3 py-1 text-xs font-medium",
          state.over
            ? "bg-primary/15 text-primary"
            : checked === myColor
              ? "bg-destructive/15 text-destructive"
              : "bg-muted text-muted-foreground",
        )}
      >
        {statusText}
      </p>

      {/* Incoming offers */}
      {invitedBy ? (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-sm">
          <span>♟️ {opponentName} က ကစားရန် ဖိတ်ခေါ်နေသည်</span>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground active:scale-95"
          >
            လက်ခံမည်
          </button>
          <button
            type="button"
            onClick={decline}
            className="rounded-full px-3 py-1 text-xs text-muted-foreground active:scale-95"
          >
            ငြင်းမည်
          </button>
        </div>
      ) : null}

      {undoAsk ? (
        <Offer
          text="↩️ တစ်ဖက်လူက ပြန်ရုပ်ခွင့် တောင်းနေသည်"
          onAccept={applyUndo}
          onDecline={() => setUndoAsk(false)}
        />
      ) : null}
      {drawAsk ? (
        <Offer
          text="🤝 တစ်ဖက်လူက သရေ ကမ်းလှမ်းနေသည်"
          onAccept={agreeDraw}
          onDecline={() => setDrawAsk(false)}
        />
      ) : null}

      {awaiting ? (
        <p className="text-center text-xs text-muted-foreground">
          တစ်ဖက်လူ လက်ခံရန် စောင့်နေသည်…
        </p>
      ) : null}
      {declined ? (
        <p className="text-center text-xs text-destructive">
          ဖိတ်ခေါ်မှုကို ငြင်းပယ်လိုက်သည်။
        </p>
      ) : null}

      {/* Move list */}
      {state.history.length > 0 ? (
        <div className="max-h-16 overflow-y-auto rounded-xl bg-muted/50 px-2 py-1.5">
          <p className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] leading-relaxed">
            {state.history.map((m, i) => (
              <span key={i}>
                {i % 2 === 0 ? (
                  <span className="text-muted-foreground">{i / 2 + 1}.</span>
                ) : null}{" "}
                <span
                  className={
                    i === state.history.length - 1 ? "font-bold text-primary" : ""
                  }
                >
                  {m.san}
                </span>
              </span>
            ))}
          </p>
        </div>
      ) : null}

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {!playing && !invitedBy ? (
          <>
            <div className="flex gap-1">
              {TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.label}
                  type="button"
                  onClick={() => setTimeControl(tc.ms)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors active:scale-95",
                    timeControl === tc.ms
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tc.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={invite}
              disabled={awaiting}
              className="flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow transition-transform active:scale-95 disabled:opacity-50"
            >
              {state.over ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Swords className="h-3.5 w-3.5" />
              )}
              {state.over ? "ထပ်ကစားမည်" : "ကစားရန် ဖိတ်ခေါ်"}
            </button>
          </>
        ) : null}

        {playing && myColor ? (
          <>
            <Chip
              icon={<Undo2 className="h-3.5 w-3.5" />}
              label="ပြန်ရုပ်"
              disabled={state.past.length === 0}
              onClick={() => broadcast("undo-req", {})}
            />
            <Chip
              icon={<Handshake className="h-3.5 w-3.5" />}
              label="သရေ"
              onClick={() => broadcast("draw-req", {})}
            />
            <Chip
              icon={<Flag className="h-3.5 w-3.5" />}
              label="လက်လျှော့"
              danger
              onClick={resign}
            />
          </>
        ) : null}

        <Chip
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          label="လှည့်"
          onClick={() => setFlipped((f) => !f)}
        />
      </div>
    </div>
  );
}

/** Material "assist chip" — a tonal pill with an icon. */
function Chip({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-40",
        danger
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Offer({
  text,
  onAccept,
  onDecline,
}: {
  text: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-xs">
      <span>{text}</span>
      <button
        type="button"
        onClick={onAccept}
        className="rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground active:scale-95"
      >
        လက်ခံ
      </button>
      <button
        type="button"
        onClick={onDecline}
        className="rounded-full px-2 py-1 text-muted-foreground active:scale-95"
      >
        ငြင်း
      </button>
    </div>
  );
}
