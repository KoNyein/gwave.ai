"use client";

import * as React from "react";
import { Coins, Flag, Loader2, Radio, RotateCcw, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  acceptChessWager,
  cancelChessWager,
  createChessWager,
  loadConversationWager,
  reportChessResult,
  setWagerLive,
} from "@/lib/actions/wagers";
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
import type { ChessWager } from "@/types/database";

interface State {
  board: Board;
  turn: Color;
  white: string | null; // user id playing white (the host in a wager)
  over: string | null; // result text, or null while playing
  winner: Color | "draw" | null; // terminal outcome, synced for auto-settle
}

function fresh(white: string | null): State {
  return { board: initialBoard(), turn: "w", white, over: null, winner: null };
}

interface PendingWager {
  wagerId: string;
  stake: number;
  host: string;
  live: boolean;
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
  // Friendly handshake.
  const [invitedBy, setInvitedBy] = React.useState<string | null>(null);
  const [awaiting, setAwaiting] = React.useState(false);
  const [declined, setDeclined] = React.useState(false);
  // Wager state.
  const [wager, setWager] = React.useState<ChessWager | null>(null);
  const [pendingWager, setPendingWager] = React.useState<PendingWager | null>(null);
  const [stake, setStake] = React.useState("100");
  const [liveOnCreate, setLiveOnCreate] = React.useState(false);
  const [wagerBusy, setWagerBusy] = React.useState(false);
  const [wagerErr, setWagerErr] = React.useState<string | null>(null);

  const chanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const pubChanRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const wagerRef = React.useRef(wager);
  wagerRef.current = wager;
  const reportedRef = React.useRef<string | null>(null);

  const refreshWager = React.useCallback(async () => {
    const w = await loadConversationWager(conversationId, "chess");
    setWager(w);
    return w;
  }, [conversationId]);

  // Restore a game in progress after a refresh + load any live wager.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setState(JSON.parse(raw) as State);
    } catch {
      /* ignore */
    }
    void refreshWager();
  }, [storeKey, refreshWager]);

  React.useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [storeKey, state]);

  // Public spectator broadcast channel — mirrors the board to /arena watchers.
  React.useEffect(() => {
    const w = wager;
    if (!w || !w.is_live || w.status !== "active") {
      pubChanRef.current = null;
      return;
    }
    const supabase = createClient();
    const channel = supabase.channel(`wager:${w.id}`, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Push the current board so a freshly-joined spectator sees it.
        void channel.send({
          type: "broadcast",
          event: "state",
          payload: { state: stateRef.current },
        });
      }
    });
    pubChanRef.current = channel;
    return () => {
      pubChanRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [wager]);

  const broadcastState = React.useCallback((next: State) => {
    void chanRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next },
    });
    void pubChanRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next },
    });
  }, []);

  // Realtime sync with the opponent.
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
      .on("broadcast", { event: "wager-open" }, (p) => {
        const pw = p.payload as PendingWager | undefined;
        if (pw && pw.host !== currentUserId) setPendingWager(pw);
      })
      .on("broadcast", { event: "wager-active" }, (p) => {
        const host = (p.payload?.host as string) ?? null;
        reportedRef.current = null;
        setState(fresh(host));
        setSel(null);
        setPendingWager(null);
        setAwaiting(false);
        void refreshWager();
      })
      .on("broadcast", { event: "state" }, (p) => {
        const next = p.payload?.state as State | undefined;
        if (next) {
          setState(next);
          setSel(null);
        }
      })
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
          void channel.send({ type: "broadcast", event: "sync-req", payload: {} });
        }
      });
    chanRef.current = channel;
    return () => {
      chanRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, refreshWager]);

  const myColor: Color | null =
    state.white === null
      ? null
      : state.white === currentUserId
        ? "w"
        : "b";
  const myTurn = myColor !== null && myColor === state.turn && !state.over;
  const playing = state.white !== null && !state.over;
  const inWager = wager?.status === "active";

  // When a wagered game ends, both players auto-report the (identical) outcome;
  // the mutual-confirmation RPC then settles the pot. No manual claim needed.
  React.useEffect(() => {
    const w = wagerRef.current;
    if (!w || w.status !== "active" || !state.winner) return;
    if (myColor === null) return;
    if (reportedRef.current === w.id) return;
    reportedRef.current = w.id;
    const result =
      state.winner === "draw"
        ? "draw"
        : state.winner === "w"
          ? "host_win"
          : "guest_win";
    void reportChessResult(w.id, result).then(() => {
      // Give the second report a moment, then refresh to show the payout.
      setTimeout(() => void refreshWager(), 1200);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.winner]);

  function advance(s: State, from: Sq, to: Sq): State {
    const board = applyMove(s.board, from, to);
    const turn: Color = s.turn === "w" ? "b" : "w";
    const st = statusOf(board, turn);
    let over: string | null = null;
    let winner: Color | "draw" | null = null;
    if (st === "checkmate") {
      over = `${s.turn === "w" ? "⚪" : "⚫"} အနိုင်ရ! (Checkmate)`;
      winner = s.turn;
    } else if (st === "stalemate") {
      over = "သရေ (Stalemate)";
      winner = "draw";
    }
    return { ...s, board, turn, over, winner };
  }

  // --- Friendly (non-money) handshake ---------------------------------------
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

  // --- Wager flow -----------------------------------------------------------
  async function openWager() {
    const amount = Math.round(Number(stake));
    if (!Number.isFinite(amount) || amount < 100) {
      setWagerErr("အနည်းဆုံး ၁၀၀ ကျပ်");
      return;
    }
    setWagerBusy(true);
    setWagerErr(null);
    const res = await createChessWager({
      conversationId,
      stakeMmk: amount,
      isLive: liveOnCreate,
    });
    setWagerBusy(false);
    if (!res.ok) {
      setWagerErr(res.error);
      return;
    }
    setAwaiting(true);
    await refreshWager();
    void chanRef.current?.send({
      type: "broadcast",
      event: "wager-open",
      payload: {
        wagerId: res.data,
        stake: amount,
        host: currentUserId,
        live: liveOnCreate,
      } satisfies PendingWager,
    });
  }

  async function acceptWager() {
    if (!pendingWager) return;
    setWagerBusy(true);
    setWagerErr(null);
    const res = await acceptChessWager(pendingWager.wagerId);
    setWagerBusy(false);
    if (!res.ok) {
      setWagerErr(res.error);
      return;
    }
    reportedRef.current = null;
    const host = pendingWager.host;
    setState(fresh(host));
    setSel(null);
    setPendingWager(null);
    await refreshWager();
    void chanRef.current?.send({
      type: "broadcast",
      event: "wager-active",
      payload: { host },
    });
  }

  async function cancelWager() {
    if (!wager) return;
    setWagerBusy(true);
    const res = await cancelChessWager(wager.id);
    setWagerBusy(false);
    if (res.ok) {
      setAwaiting(false);
      await refreshWager();
    } else {
      setWagerErr(res.error);
    }
  }

  async function toggleLive() {
    if (!wager) return;
    const res = await setWagerLive(wager.id, !wager.is_live);
    if (res.ok) await refreshWager();
  }

  function resign() {
    if (!myColor || state.over) return;
    const next: State = {
      ...state,
      over: `${myColor === "w" ? "⚪" : "⚫"} လက်လျှော့ — တစ်ဖက်လူ အနိုင်ရ!`,
      winner: myColor === "w" ? "b" : "w",
    };
    setState(next);
    broadcastState(next);
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
        broadcastState(next);
        return;
      }
      if (piece && colorOf(piece) === myColor) setSel({ r, c });
      else setSel(null);
      return;
    }
    if (piece && colorOf(piece) === myColor) setSel({ r, c });
  }

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

  const showWagerSetup = !playing && !wager && !invitedBy && !pendingWager;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{statusText}</p>

      {/* Money strip for an active/finished wager */}
      {wager && wager.status !== "cancelled" ? (
        <div className="mx-auto flex max-w-[360px] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border bg-amber-50/60 px-3 py-1.5 text-xs dark:bg-amber-950/20">
          <span className="inline-flex items-center gap-1 font-medium">
            <Coins className="h-3.5 w-3.5 text-amber-600" />
            ဆု {wager.pot_mmk.toLocaleString("en-US")} ကျပ်
          </span>
          <span className="text-muted-foreground">
            ထိုးငွေ {wager.stake_mmk.toLocaleString("en-US")} ({wager.rake_bps / 100}% commission)
          </span>
          {wager.is_live ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <Radio className="h-3.5 w-3.5" /> LIVE · 👁 {wager.spectators}
            </span>
          ) : null}
          {wager.status === "settled" ? (
            <span className="font-semibold text-emerald-600">
              {wager.result === "draw"
                ? "သရေ — ငွေပြန်အမ်း"
                : `ဆုငွေ ${wager.payout_mmk.toLocaleString("en-US")} ကျပ် ထုတ်ပေးပြီး`}
            </span>
          ) : wager.status === "disputed" ? (
            <span className="font-semibold text-destructive">
              ရလဒ်မကိုက် — admin စစ်ဆေးဆဲ
            </span>
          ) : null}
          {inWager ? (
            <button
              type="button"
              onClick={() => void toggleLive()}
              className="underline hover:no-underline"
            >
              {wager.is_live ? "Live ပိတ်" : "🔴 Live ဖွင့်"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Friendly invite banner */}
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

      {/* Wager deposit banner (opponent must match the stake) */}
      {pendingWager ? (
        <div className="mx-auto max-w-[360px] space-y-2 rounded-lg border border-amber-400/50 bg-amber-50/60 px-3 py-2 text-sm dark:bg-amber-950/20">
          <p className="flex items-center gap-1 font-medium">
            <Coins className="h-4 w-4 text-amber-600" />
            တစ်ဖက်လူက {pendingWager.stake.toLocaleString("en-US")} ကျပ် ထိုးထားသည်
            {pendingWager.live ? " · 🔴 Live" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            လက်ခံပါက သင့် G-Pay မှ {pendingWager.stake.toLocaleString("en-US")} ကျပ် ထိုးရမည်။
            အနိုင်ရသူက ဆုငွေ (commission ၁% နုတ်) ရမည်။
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void acceptWager()} disabled={wagerBusy}>
              {wagerBusy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Coins className="mr-1 h-4 w-4" />
              )}
              ထိုး၍ ကစားမည်
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPendingWager(null)}
              disabled={wagerBusy}
            >
              ငြင်းမည်
            </Button>
          </div>
        </div>
      ) : null}

      {awaiting ? (
        <p className="text-center text-xs text-muted-foreground">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          တစ်ဖက်လူ လက်ခံရန် စောင့်ဆိုင်းနေသည်…
          {wager && wager.status === "open" ? (
            <button
              type="button"
              onClick={() => void cancelWager()}
              className="ml-2 underline"
            >
              ဖျက်၍ ငွေပြန်ယူ
            </button>
          ) : null}
        </p>
      ) : null}
      {declined ? (
        <p className="text-center text-xs text-destructive">
          တစ်ဖက်လူက ဖိတ်ခေါ်မှုကို ငြင်းပယ်လိုက်သည်။
        </p>
      ) : null}
      {wagerErr ? (
        <p className="text-center text-xs text-destructive">❌ {wagerErr}</p>
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

      {/* Wager setup */}
      {showWagerSetup ? (
        <div className="mx-auto max-w-[360px] space-y-2 rounded-lg border p-2">
          <p className="flex items-center gap-1 text-xs font-medium">
            <Coins className="h-3.5 w-3.5 text-amber-600" /> G-Pay ထိုး၍ ကစားမည်
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={100}
              step={100}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="h-8 w-28"
            />
            <span className="text-xs text-muted-foreground">ကျပ်</span>
            <label className="ml-auto flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={liveOnCreate}
                onChange={(e) => setLiveOnCreate(e.target.checked)}
              />
              🔴 Live
            </label>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => void openWager()}
            disabled={wagerBusy}
          >
            {wagerBusy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Coins className="mr-1 h-4 w-4" />
            )}
            ထိုး၍ ဖိတ်ခေါ်မည်
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            နှစ်ဦးစလုံး ငွေထိုးပြီးမှ စတင်သည်။ အနိုင်ရသူက ဆု (၁% commission နုတ်) ရမည်။
          </p>
        </div>
      ) : null}

      <div className="flex justify-center gap-2">
        {showWagerSetup ? (
          <Button size="sm" variant="outline" onClick={invite} disabled={awaiting}>
            <Swords className="mr-1 h-4 w-4" /> အခမဲ့ ကစားရန် ဖိတ်ခေါ်
          </Button>
        ) : null}
        {myColor && !state.over ? (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={resign}>
            <Flag className="mr-1 h-4 w-4" /> လက်လျှော့
          </Button>
        ) : null}
        {state.over && !wager ? (
          <Button size="sm" variant="outline" onClick={invite} disabled={awaiting}>
            <RotateCcw className="mr-1 h-4 w-4" /> အသစ်
          </Button>
        ) : null}
      </div>
    </div>
  );
}
