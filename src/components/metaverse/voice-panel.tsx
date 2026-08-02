"use client";

import { useState } from "react";

/// Voice chat ရဲ့ HUD (Phase 14.4)。
///
/// ★ မဖြစ်မနေ ၃ ခု — Mute · Report · mic default ပိတ်။ ဒီ panel မှာ
///   အဲဒါတွေ အကုန်ရှိတယ်။
/// ★ Report က voice ကို record မလုပ်ဘဲ metadata (ဘယ်သူ၊ ဘယ် room) ပဲ
///   ပို့တယ် — moderation queue (admin) ထဲ ဝင်တယ်။

const btn =
  "rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur transition hover:bg-black/70";

export function VoicePanel({
  state,
  micOn,
  peers,
  mutes,
  meId,
  room,
  names,
  open,
  onToggle,
  onJoin,
  onLeave,
  onMic,
  onMutePeer,
}: {
  state: "off" | "joining" | "on" | "denied-age" | "denied-auth" | "denied-full";
  micOn: boolean;
  peers: { id: string; muted: boolean }[];
  mutes: Set<string>;
  meId: string;
  room: string;
  names: (id: string) => string;
  /// ဖွင့်/ပိတ်ကို scene က ကိုင်တယ် — ဘယ်ဘက်တန်းမှာ panel တစ်ခုတည်းသာ
  /// တစ်ပြိုင်နက် ပွင့်စေချင်လို့ (accordion)。
  open: boolean;
  onToggle: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onMic: (on: boolean) => void;
  onMutePeer: (id: string, muted: boolean) => void;
}) {
  const [reported, setReported] = useState<Set<string>>(new Set());

  const report = async (id: string) => {
    setReported((prev) => new Set(prev).add(id));
    await fetch("/api/metaverse/voice/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: id, room }),
    }).catch(() => null);
  };

  const others = peers.filter((p) => p.id !== meId);

  return (
    <>
      <button
        data-hud="1"
        onClick={onToggle}
        title="အသံစကားပြော"
        className={`${btn} ${
          state === "on" || open ? "border-emerald-400/60" : ""
        }`}
      >
        🎙 အသံ{state === "on" ? ` (${peers.length})` : ""}
      </button>

      {open && (
        <div
          data-hud="1"
          className="w-[min(15rem,72vw)] rounded-xl border border-white/15 bg-black/70 p-2 text-white backdrop-blur"
        >
          {state === "denied-age" && (
            // ★ ၁၈+ ဂိတ် — ကလေးသူငယ် ကာကွယ်ရေး (spec 14.0)。 ဒီစစ်ဆေးမှုက
            // server မှာ — ဒီစာက ရှင်းပြရုံပဲ။
            <div className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] leading-snug text-amber-200">
              အသံစကားပြောခန်းက အသက် ၁၈ နှစ်ပြည့်ပြီး မွေးသက္ကရာဇ်
              အတည်ပြုထားသူများသာ ဝင်လို့ရပါတယ်။
            </div>
          )}
          {state === "denied-auth" && (
            <div className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] text-amber-200">
              Gwave အကောင့်နဲ့ ဝင်ထားမှ အသံစကားပြောလို့ရပါတယ်။
            </div>
          )}
          {state === "denied-full" && (
            <div className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] text-amber-200">
              စကားပြောခန်း ပြည့်နေပါပြီ — ခဏနေ ပြန်ကြိုးစားပါ။
            </div>
          )}

          {(state === "off" ||
            state === "denied-age" ||
            state === "denied-auth" ||
            state === "denied-full") && (
            <button
              onClick={onJoin}
              className={`mt-1 w-full ${btn} bg-emerald-500/20`}
            >
              🎙 အသံခန်းထဲ ဝင်မယ်
            </button>
          )}
          {state === "joining" && (
            <div className="px-1 py-2 text-center text-[11px] text-white/50">
              ချိတ်နေသည်…
            </div>
          )}

          {state === "on" && (
            <div className="space-y-1.5">
              {/* ★ Mic default ပိတ် — ဖွင့်မှသာ အသံထွက်တယ် (spec 14.4) */}
              <button
                onClick={() => onMic(!micOn)}
                className={`w-full rounded-lg border px-2.5 py-2 text-[12px] font-semibold transition ${
                  micOn
                    ? "border-emerald-400/70 bg-emerald-500/30 text-emerald-100"
                    : "border-white/20 bg-black/50 text-white/70"
                }`}
              >
                {micOn ? "🎤 Mic ဖွင့်ထားသည် — ပိတ်မယ်" : "🔇 Mic ပိတ်ထားသည် — ဖွင့်မယ်"}
              </button>

              {others.length === 0 && (
                <div className="px-1 py-1 text-[11px] text-white/40">
                  တခြား ဘယ်သူမှ မရှိသေးပါ
                </div>
              )}
              {others.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] text-white/80">
                    {p.muted ? "🔇" : "🔊"} {names(p.id)}
                  </span>
                  {/* တစ်ယောက်ချင်း mute — ကိုယ့်ဘက်မှာပဲ တိတ်တယ် */}
                  <button
                    onClick={() => onMutePeer(p.id, !mutes.has(p.id))}
                    title={mutes.has(p.id) ? "ပြန်ဖွင့်" : "ဒီလူကို တိတ်"}
                    className="rounded px-1.5 py-0.5 text-[11px] text-white/60 hover:bg-white/10"
                  >
                    {mutes.has(p.id) ? "🔈" : "🚫"}
                  </button>
                  {/* ★ Report — မဖြစ်မနေ (spec 14.4)。 Moderator ဆီ ရောက်တယ်။ */}
                  <button
                    onClick={() => void report(p.id)}
                    disabled={reported.has(p.id)}
                    title="Moderator ဆီ တိုင်ကြားရန်"
                    className="rounded px-1.5 py-0.5 text-[11px] text-white/60 hover:bg-white/10 disabled:opacity-40"
                  >
                    {reported.has(p.id) ? "✓" : "🚩"}
                  </button>
                </div>
              ))}

              <button onClick={onLeave} className={`w-full ${btn}`}>
                ထွက်မယ်
              </button>
              <div className="px-1 text-[10px] leading-snug text-white/40">
                အသံကို မှတ်တမ်းမတင်ပါ။ နီးတဲ့သူကိုသာ ကြားရပြီး ၂၅ မီတာကျော်ရင်
                မကြားရတော့ပါ။
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
