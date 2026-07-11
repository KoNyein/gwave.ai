"use client";

import * as React from "react";
import { Coins, Flag, Loader2, Radio, RotateCcw, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptChessWager,
  cancelChessWager,
  createChessWager,
  loadConversationWager,
  reportChessResult,
  setWagerLive,
} from "@/lib/actions/wagers";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ChessWager } from "@/types/database";

/**
 * ကျားထိုး — traditional Myanmar tigers-and-cattle board game in messenger.
 * Supports friendly games (mutual-consent invite) and G-Pay wagered games
 * with the same escrow, live broadcast and spectator monetization as chess.
 * The wager host always plays the tigers.
 */

const MARGIN = 26;
const STEP = 62;
const SIZE = MARGIN * 2 + STEP * (KYAR_N - 1);
const px = (i: number) => MARGIN + (i % KYAR_N) * STEP;
const py = (i: number) => MARGIN + Math.floor(i / KYAR_N) * STEP;

interface PendingWager {
  wagerId: string;
  stake: number;
  host: string;
  live: boolean;
}

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
    const w = await loadConversationWager(conversationId, "kyar");
    setWager(w);
    return w;
  }, [conversationId]);

  React.useEffect(() => {
    void refreshWager();
  }, [refreshWager]);

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

  const broadcastState = React.useCallback((next: KyarState) => {
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

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`game:${conversationId}:kyar`, {
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
      .on("broadcast", { event: "wager-open" }, (p) => {
        const pw = p.payload as PendingWager | undefined;
        if (pw && pw.host !== currentUserId) setPendingWager(pw);
      })
      .on("broadcast", { event: "wager-active" }, (p) => {
        const host = (p.payload?.host as string) ?? null;
        reportedRef.current = null;
        setState(kyarFresh(host));
        setSelected(null);
        setPendingWager(null);
        setAwaiting(false);
        void refreshWager();
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
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, refreshWager]);

  const mySide: "T" | "G" | null =
    state.tiger === null ? null : state.tiger === currentUserId ? "T" : "G";
  const result = kyarWinnerOf(state);
  const playing = state.tiger !== null && !result;
  const myTurn = playing && mySide !== null && mySide === state.turn;
  const placing = state.goatsLeft > 0;
  const inWager = wager?.status === "active";

  // When a wagered match ends, both players auto-report the same outcome;
  // the mutual-confirmation RPC settles the pot. Tigers = wager host.
  React.useEffect(() => {
    const w = wagerRef.current;
    if (!w || w.status !== "active" || !result) return;
    if (mySide === null) return;
    if (reportedRef.current === w.id) return;
    reportedRef.current = w.id;
    void reportChessResult(w.id, result === "T" ? "host_win" : "guest_win").then(
      () => {
        setTimeout(() => void refreshWager(), 1200);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const legal: KyarMove[] =
    selected !== null && state.cells[selected] === mySide && !(mySide === "G" && placing)
      ? kyarMovesFrom(state.cells, selected)
      : [];

  function push(next: KyarState) {
    setState(next);
    setSelected(null);
    broadcastState(next);
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
      game: "kyar",
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
    setState(kyarFresh(host));
    setSelected(null);
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
    if (!mySide || result) return;
    // Losing side resigns → capture-count / turn tricks aside, declare
    // the opponent the winner by fast-forwarding the terminal state.
    const next: KyarState =
      mySide === "T"
        ? { ...state, cells: state.cells.map((c) => (c === "T" ? null : c)), turn: "T" }
        : { ...state, captured: CAPTURES_TO_WIN };
    push(next);
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

  const showWagerSetup = !playing && !wager && !invitedBy && !pendingWager;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-medium">{status}</p>

      {playing ? (
        <p className="text-center text-xs text-muted-foreground">
          ဖမ်းမိ {state.captured}/{CAPTURES_TO_WIN} ကောင် · ကွင်းပြင်ပ နွား{" "}
          {state.goatsLeft} ကောင်
        </p>
      ) : null}

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

      {invitedBy ? (
        <div className="mx-auto flex max-w-[320px] flex-wrap items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span>🐯 တစ်ဖက်လူက ကျားထိုး ကစားရန် ဖိတ်ခေါ်နေသည်</span>
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
        <div className="mx-auto max-w-[320px] space-y-2 rounded-lg border border-amber-400/50 bg-amber-50/60 px-3 py-2 text-sm dark:bg-amber-950/20">
          <p className="flex items-center gap-1 font-medium">
            <Coins className="h-4 w-4 text-amber-600" />
            တစ်ဖက်လူက {pendingWager.stake.toLocaleString("en-US")} ကျပ် ထိုးထားသည်
            {pendingWager.live ? " · 🔴 Live" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            လက်ခံပါက သင့် G-Pay မှ {pendingWager.stake.toLocaleString("en-US")} ကျပ် ထိုးရမည်။
            ဖိတ်သူက ကျား၊ သင်က နွား ကစားရမည်။ အနိုင်ရသူက ဆုငွေ (commission ၁% နုတ်) ရမည်။
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

      {/* Wager setup */}
      {showWagerSetup ? (
        <div className="mx-auto max-w-[320px] space-y-2 rounded-lg border p-2">
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
        {mySide && !result ? (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={resign}>
            <Flag className="mr-1 h-4 w-4" /> လက်လျှော့
          </Button>
        ) : null}
        {result && !wager ? (
          <Button size="sm" variant="outline" onClick={invite} disabled={awaiting}>
            <RotateCcw className="mr-1 h-4 w-4" /> အသစ်
          </Button>
        ) : null}
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
