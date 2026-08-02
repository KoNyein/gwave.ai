"use client";

import { useEffect, useState } from "react";

import type { GameInfo, GameRanking, GameScore } from "./net";

/// Mini-game ရဲ့ HUD (Phase 16)。
///
/// ★ ဒီ component က **အမှတ် တစ်လုံးမှ မတွက်ဘူး** — server ပို့တဲ့
///   `scores` / `rankings` ကို ပြရုံပဲ။ တွက်လိုက်ရင် devtools ကနေ ပြင်ပြီး
///   leaderboard တက်လို့ရသွားမယ် (spec 16.6)。
/// ★ Sub-component တွေကို **module scope မှာ ကြေညာရမယ်** — component ထဲမှာ
///   ကြေညာရင် render တိုင်း type အသစ်ဖြစ်ပြီး React က panel တစ်ခုလုံးကို
///   ဖျက်ပြီး ပြန်ဆောက်တယ် (Phase 15 မှာ ဒါနဲ့ ကြုံခဲ့တယ်)。
/// ★ နှစ်ပိုင်း ခွဲထားတယ် — `GamesOverlays` (scoreboard/lobby/ရလဒ်၊ scene
///   root မှာ absolute) နဲ့ `GamesMenu` (ခလုတ် + panel၊ ဘယ်ဘက်တန်းထဲ flow)。
///   အရင်က တစ်ခုတည်းမှာ absolute top offset တွေနဲ့ ချထားလို့ ခလုတ်တွေနဲ့
///   panel တွေ ထပ်နေတယ် (landscape မှာ ဆိုးတယ်)。

export type GamePhase =
  | { kind: "idle" }
  | { kind: "lobby"; gameId: string; nameMy: string; startsAt: number; joined: number }
  | {
      kind: "playing";
      gameId: string;
      nameMy: string;
      playing: boolean;
      timeLeft: number;
      scores: GameScore[];
    }
  | { kind: "ended"; gameId: string; rankings: GameRanking[]; won: boolean };

type BoardEntry = { userId: string; name: string; score: number };
type Board = { weekly: BoardEntry[]; allTime: BoardEntry[] };

const GAME_ICONS: Record<string, string> = {
  race: "🏁",
  hunt: "🔍",
  targets: "🎯",
  grow: "🌱",
};

const btn =
  "rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur transition hover:bg-black/70";

function Rows({ rows }: { rows: BoardEntry[] }) {
  if (rows.length === 0) {
    return <div className="px-1 py-2 text-[11px] text-white/40">မှတ်တမ်း မရှိသေးပါ</div>;
  }
  return (
    <ol className="space-y-0.5">
      {rows.slice(0, 10).map((r, i) => (
        <li
          key={r.userId}
          className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] odd:bg-white/5"
        >
          <span className="w-4 shrink-0 text-white/40">{i + 1}</span>
          {/* ★ နာမည်က user ရဲ့ စာ — React က escape လုပ်ပေးတယ်၊
              dangerouslySetInnerHTML ဘယ်တော့မှ မသုံးရ။ */}
          <span className="min-w-0 flex-1 truncate text-white/80">{r.name}</span>
          <span className="shrink-0 font-semibold text-emerald-300">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Scoreboard({
  nameMy,
  timeLeft,
  scores,
  meId,
  playing,
}: {
  nameMy: string;
  timeLeft: number;
  scores: GameScore[];
  meId: string;
  playing: boolean;
}) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 w-[min(15rem,80vw)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/55 p-2 text-white backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-emerald-300">{nameMy}</span>
        <span className="tabular-nums text-white/70">
          ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </span>
      </div>
      {/* ★ မကစားဘဲ ကြည့်နေသူကို "ကြည့်နေသည်" လို့ ပြောရမယ် — မဟုတ်ရင်
          ကိုယ့်အမှတ် ဘာလို့ မတက်လဲ လို့ ထင်နေမယ် (spec 16.6)。 */}
      {!playing && (
        <div className="mb-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
          👀 ဘေးကနေ ကြည့်နေသည်
        </div>
      )}
      <ol className="space-y-0.5">
        {sorted.slice(0, 6).map((s, i) => (
          <li
            key={s.id}
            className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[11px] ${
              s.id === meId ? "bg-emerald-500/25 text-emerald-100" : "text-white/75"
            }`}
          >
            <span className="w-4 shrink-0 text-white/40">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="shrink-0 tabular-nums font-semibold">{s.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/// Scene root မှာ ချထားရမယ့် အပိုင်း — scoreboard / lobby / ရလဒ် /
/// ကစားနေစဉ် လုပ်ဆောင်ချက်ခလုတ်။ Screen center / ညာအောက်ကို absolute
/// နဲ့ ကပ်လို့ ဘယ်ဘက်တန်း (containing block) ထဲ ထည့်လို့မရဘူး။
export function GamesOverlays({
  phase,
  meId,
  onJoin,
  onAction,
  onDismissEnd,
}: {
  phase: GamePhase;
  meId: string;
  onJoin: (gameId: string) => void;
  onAction: (action: Record<string, unknown>) => void;
  onDismissEnd: () => void;
}) {
  /// Lobby ရဲ့ ရေတွက်ချိန် — 1Hz မှာ ပြန်ဆွဲတယ်
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase.kind !== "lobby") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  const playing = phase.kind === "playing" && phase.playing;

  return (
    <>
      {phase.kind === "playing" && (
        <Scoreboard
          nameMy={phase.nameMy}
          timeLeft={phase.timeLeft}
          scores={phase.scores}
          meId={meId}
          playing={phase.playing}
        />
      )}

      {/* ── ပွဲစတော့မယ် ─────────────────────────────────────────────────── */}
      {phase.kind === "lobby" && (
        <div className="absolute left-1/2 top-3 z-20 w-[min(17rem,84vw)] -translate-x-1/2 rounded-xl border border-emerald-400/40 bg-black/65 p-2.5 text-center text-white backdrop-blur">
          <div className="text-[12px] font-semibold text-emerald-300">
            {phase.nameMy} စတော့မယ်
          </div>
          <div className="mt-0.5 text-[11px] text-white/70">
            {Math.max(0, Math.ceil((phase.startsAt - now) / 1000))} စက္ကန့် · လူ{" "}
            {phase.joined} ယောက်
          </div>
          <button
            data-hud="1"
            onClick={() => onJoin(phase.gameId)}
            className="mt-1.5 rounded-lg border border-emerald-400/60 bg-emerald-500/25 px-3 py-1 text-[11px] text-emerald-100 transition hover:bg-emerald-500/40"
          >
            ငါလည်း ဝင်မယ်
          </button>
        </div>
      )}

      {/* ── ရလဒ် ────────────────────────────────────────────────────────── */}
      {phase.kind === "ended" && (
        <div className="absolute left-1/2 top-1/2 z-30 w-[min(18rem,86vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/80 p-4 text-white backdrop-blur">
          <div className="text-center text-sm font-semibold text-emerald-300">
            {phase.won ? "🏆 အနိုင်ရပါတယ်!" : "ပွဲပြီးပါပြီ"}
          </div>
          <ol className="mt-2 space-y-0.5">
            {phase.rankings.slice(0, 8).map((r) => (
              <li
                key={r.playerId}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-[11px] ${
                  r.playerId === meId ? "bg-emerald-500/25 text-emerald-100" : "text-white/75"
                }`}
              >
                <span className="w-4 shrink-0 text-white/40">{r.rank}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="shrink-0 tabular-nums font-semibold">{r.score}</span>
              </li>
            ))}
          </ol>
          {/* ★ ဆုက **cosmetic သာ** — ငွေ/credit မပါဘူး (spec 16.4)。
              ဝင်ကြေးလည်း မယူဘူး၊ ဒါမှ လောင်းကစားနဲ့ မနီးဘူး။ */}
          <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-center text-[10px] leading-snug text-white/50">
            ဆုလာဘ်က အလှဆင်ပစ္စည်း (badge) သာ ဖြစ်ပါတယ် — ငွေကြေး မပါဝင်ပါ။
          </div>
          <button
            data-hud="1"
            onClick={onDismissEnd}
            className={`mt-2 w-full ${btn}`}
          >
            ပိတ်မယ်
          </button>
        </div>
      )}

      {/* ── ကစားနေစဉ် လုပ်ဆောင်ချက် ခလုတ်များ ───────────────────────────
          ★ ခလုတ်က "လုပ်တယ်" ဆိုတာပဲ ပို့တယ် — ရလဒ်ကို server က တွက်တယ်။ */}
      {playing && phase.kind === "playing" && phase.gameId === "targets" && (
        <button
          data-hud="1"
          onClick={() => onAction({ type: "shoot" })}
          className="absolute bottom-24 right-6 z-20 h-16 w-16 rounded-full border border-red-400/60 bg-red-500/30 text-xl text-white backdrop-blur active:bg-red-500/50 sm:bottom-20"
        >
          🎯
        </button>
      )}
      {playing && phase.kind === "playing" && phase.gameId === "grow" && (
        <div className="absolute bottom-24 right-6 z-20 flex flex-col gap-2 sm:bottom-20">
          <button
            data-hud="1"
            onClick={() => onAction({ type: "plant" })}
            className="h-14 w-14 rounded-full border border-emerald-400/60 bg-emerald-500/30 text-lg text-white backdrop-blur active:bg-emerald-500/50"
            title="အပင်စိုက်"
          >
            🌱
          </button>
          <button
            data-hud="1"
            onClick={() => onAction({ type: "water" })}
            className="h-14 w-14 rounded-full border border-sky-400/60 bg-sky-500/30 text-lg text-white backdrop-blur active:bg-sky-500/50"
            title="ရေလောင်း"
          >
            💧
          </button>
        </div>
      )}
    </>
  );
}

/// ဘယ်ဘက်တန်းထဲက ခလုတ် + panel — flow layout (absolute မဟုတ်ဘူး) မို့
/// ဘယ်တော့မှ တခြား HUD နဲ့ မထပ်ဘူး။ ဖွင့်/ပိတ်ကို scene က ကိုင်တယ် —
/// panel တစ်ခုတည်းသာ တစ်ပြိုင်နက် ပွင့်စေချင်လို့။
export function GamesMenu({
  games,
  connected,
  open,
  onToggle,
  onJoin,
}: {
  games: GameInfo[];
  connected: boolean;
  open: boolean;
  onToggle: () => void;
  onJoin: (gameId: string) => void;
}) {
  const [tab, setTab] = useState<"play" | "board">("play");
  const [boardGame, setBoardGame] = useState("race");
  const [board, setBoard] = useState<Board | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);

  useEffect(() => {
    if (!open || tab !== "board") return;
    let alive = true;
    setBoardBusy(true);
    void fetch(`/api/metaverse/leaderboard?game=${encodeURIComponent(boardGame)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Board | null) => {
        if (alive) setBoard(j);
      })
      .catch(() => {
        // Leaderboard ဆွဲမရလည်း ပွဲက ဆက်ကစားလို့ရရမယ်
        if (alive) setBoard(null);
      })
      .finally(() => {
        if (alive) setBoardBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [open, tab, boardGame]);

  return (
    <>
      {/* ── ခလုတ် + panel (accordion) ──────────────────────────────────── */}
      <button
        data-hud="1"
        onClick={onToggle}
        title="ကစားပွဲများ"
        className={`${btn} ${open ? "border-emerald-400/60" : ""}`}
      >
        🎮 ပွဲများ
      </button>

      {open && (
        <div
          data-hud="1"
          className="w-[min(15rem,72vw)] rounded-xl border border-white/15 bg-black/70 p-2 text-white backdrop-blur"
        >
          <div className="mb-2 flex gap-1">
            <button
              onClick={() => setTab("play")}
              className={`flex-1 rounded px-2 py-1 text-[11px] transition ${
                tab === "play" ? "bg-emerald-500/25 text-emerald-200" : "text-white/60"
              }`}
            >
              ကစားရန်
            </button>
            <button
              onClick={() => setTab("board")}
              className={`flex-1 rounded px-2 py-1 text-[11px] transition ${
                tab === "board" ? "bg-emerald-500/25 text-emerald-200" : "text-white/60"
              }`}
            >
              အမှတ်စာရင်း
            </button>
          </div>

          {tab === "play" && (
            <div className="space-y-1">
              {!connected && (
                <div className="rounded bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200">
                  Server နဲ့ မချိတ်ရသေးလို့ ပွဲ မကစားနိုင်သေးပါ။
                </div>
              )}
              {games.map((g) => (
                <button
                  key={g.id}
                  disabled={!connected}
                  onClick={() => onJoin(g.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                >
                  <span className="text-base">{GAME_ICONS[g.id] ?? "🎮"}</span>
                  <span className="min-w-0 flex-1 truncate">{g.nameMy}</span>
                  <span className="shrink-0 text-[10px] text-white/40">
                    {Math.round(g.durationSec / 60)} မိနစ်
                  </span>
                </button>
              ))}
              <div className="px-1 pt-1 text-[10px] leading-snug text-white/40">
                ဝင်ကြေး မရှိပါ။ ဆုလာဘ်က badge သာ ဖြစ်ပြီး ငွေကြေး မပါဝင်ပါ။
              </div>
            </div>
          )}

          {tab === "board" && (
            <div className="space-y-2">
              <div className="flex gap-1">
                {games.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setBoardGame(g.id)}
                    title={g.nameMy}
                    className={`flex-1 rounded px-1 py-1 text-sm transition ${
                      boardGame === g.id ? "bg-emerald-500/25" : "hover:bg-white/10"
                    }`}
                  >
                    {GAME_ICONS[g.id] ?? "🎮"}
                  </button>
                ))}
              </div>
              {boardBusy && <div className="px-1 text-[11px] text-white/40">ဆွဲနေသည်…</div>}
              {!boardBusy && (
                <>
                  {/* ★ တစ်ပတ်စာကို **အပေါ်မှာ** ထားတယ် — အသစ်စတဲ့သူက
                      all-time ကို ဘယ်တော့မှ မမီဘူးလို့ ခံစားရမယ် (spec 16.5)。 */}
                  <div>
                    <div className="px-1 text-[10px] font-semibold text-emerald-300">
                      ဒီတစ်ပတ်
                    </div>
                    <Rows rows={board?.weekly ?? []} />
                  </div>
                  <div>
                    <div className="px-1 text-[10px] font-semibold text-white/50">
                      အချိန်တိုင်း
                    </div>
                    <Rows rows={board?.allTime ?? []} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
