"use client";

import { useCallback, useEffect, useState } from "react";

/// 🫂 In-world Social Hub — metaverse standard အတိုင်း "လောကထဲက မထွက်ဘဲ
/// လူမှုလုပ်ငန်းအားလုံး လုပ်နိုင်ရမယ်" ဆိုတဲ့ အခြေခံကို ဖြည့်တယ်
/// (user: "login ဝင်တာနဲ့ metaverse room ထဲရောက် · detail function ထည့်")။
///
/// Tab ၄ ခု — အားလုံး gwave API အစစ်ကနေ ဆွဲတယ်:
///   📰 Feed        /api/posts?scope=feed
///   👥 ဒီမှာရှိသူ   room roster (scene ကပေးတဲ့ live list)
///   🔔 အသိပေးချက်  /api/notifications
///   💬 စာများ      /api/conversations
///
/// ★ ရွေးထားတဲ့ tab ကျမှ fetch — panel ဖွင့်ရုံနဲ့ API ၄ ခုစလုံး မခေါ်ဘူး။
/// ★ Guest (401) ဒါမှမဟုတ် ကွန်ရက်ပြတ်ရင် "ဝင်ရောက်ပါ" မက်ဆေ့ချပြတယ် —
///   overlay က ဘယ်တော့မှ ဗလာ မဖြစ်ဘူး။

type Tab = "feed" | "here" | "alerts" | "dm";

export type RoomPeer = { id: string; name: string; talking?: boolean };

type Post = {
  id: string;
  content: string | null;
  created_at: string;
  author?: { full_name?: string | null; username?: string | null } | null;
};
type Alert = {
  id: string;
  type?: string | null;
  created_at: string;
  read_at?: string | null;
  actor?: { full_name?: string | null; username?: string | null } | null;
};
type Convo = {
  id: string;
  unread?: boolean;
  last_message?: { content: string | null; created_at: string } | null;
  participants?: { profile?: { full_name?: string | null; username?: string | null } }[];
};

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "feed", icon: "📰", label: "Feed" },
  { id: "here", icon: "👥", label: "ဒီမှာ" },
  { id: "alerts", icon: "🔔", label: "အသိပေး" },
  { id: "dm", icon: "💬", label: "စာများ" },
];

/// မြန်မာလို "ဘယ်လောက်ကြာပြီ" — feed/alert/DM သုံးခုလုံး ဒါကိုသုံး
function agoMy(iso: string): string {
  const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ယခုလေးတင်";
  if (m < 60) return `${Math.floor(m)} မိနစ်`;
  if (m < 1440) return `${Math.floor(m / 60)} နာရီ`;
  return `${Math.floor(m / 1440)} ရက်`;
}

const nameOf = (p?: { full_name?: string | null; username?: string | null } | null) =>
  p?.full_name || p?.username || "Gwave";

const ALERT_MY: Record<string, string> = {
  like: "❤️ သဘောကျတယ်",
  comment: "💬 မှတ်ချက်ပေးတယ်",
  friend_request: "🤝 မိတ်ဆွေဖိတ်တယ်",
  friend_accept: "✅ မိတ်ဆွေဖြစ်သွားပြီ",
  follow: "👀 စောင့်ကြည့်တယ်",
  mention: "📣 ခေါ်လိုက်တယ်",
  share: "🔁 မျှဝေတယ်",
};

export function SocialHub({
  onClose,
  peers,
  onDm,
}: {
  onClose: () => void;
  /// လောကထဲ ခုရှိနေတဲ့ လူများ (scene က live ပေးတယ်)
  peers: RoomPeer[];
  /// 💬 ခလုတ်နှိပ်ရင် messenger ဖွင့် (web page ကို overlay နဲ့)
  onDm: (path: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [convos, setConvos] = useState<Convo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (which: Tab) => {
      setErr(null);
      try {
        if (which === "feed" && posts === null) {
          const r = await fetch("/api/posts?scope=feed", { cache: "no-store" });
          if (!r.ok) throw new Error("auth");
          const d = (await r.json()) as { posts?: Post[] };
          setPosts(d.posts ?? []);
        }
        if (which === "alerts" && alerts === null) {
          const r = await fetch("/api/notifications", { cache: "no-store" });
          if (!r.ok) throw new Error("auth");
          const d = (await r.json()) as { notifications?: Alert[] };
          setAlerts(d.notifications ?? []);
        }
        if (which === "dm" && convos === null) {
          const r = await fetch("/api/conversations", { cache: "no-store" });
          if (!r.ok) throw new Error("auth");
          const d = (await r.json()) as { conversations?: Convo[] };
          setConvos(d.conversations ?? []);
        }
      } catch {
        setErr("ဆွဲလို့ မရပါ — Gwave account နဲ့ ဝင်ထားလား စစ်ပါ");
      }
    },
    [posts, alerts, convos],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  return (
    <div
      data-hud="1"
      className="pointer-events-auto absolute inset-x-0 bottom-0 top-14 z-[60] mx-auto flex w-[min(30rem,96vw)] flex-col rounded-t-2xl border border-white/15 bg-black/85 backdrop-blur sm:inset-y-10 sm:right-4 sm:left-auto sm:rounded-2xl"
    >
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        <span className="px-1 text-sm font-semibold text-white/90">🫂 Social</span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${
                tab === t.id
                  ? "bg-emerald-500/25 text-emerald-200"
                  : "text-white/65 hover:bg-white/5"
              }`}
            >
              {t.icon} {t.label}
              {t.id === "here" && peers.length > 0 && (
                <span className="ml-1 text-emerald-300">{peers.length}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="min-h-[36px] rounded-lg px-2.5 text-white/60 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[13px]">
        {err && (
          <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-amber-200">{err}</p>
        )}

        {tab === "feed" &&
          (posts === null ? (
            <Loading />
          ) : posts.length === 0 ? (
            <Empty text="ပို့စ် မရှိသေးပါ" />
          ) : (
            posts.slice(0, 20).map((p) => (
              <article key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[12px] text-emerald-300">
                  {nameOf(p.author)}
                  <span className="ml-2 text-white/40">{agoMy(p.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-white/85">
                  {p.content?.slice(0, 400) || "…"}
                </p>
              </article>
            ))
          ))}

        {tab === "here" &&
          (peers.length === 0 ? (
            <Empty text="ဒီအခန်းမှာ ကိုယ်တစ်ယောက်တည်း ရှိသေးတယ်" />
          ) : (
            peers.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5"
              >
                <span className={p.talking ? "text-emerald-400" : "text-white/30"}>
                  {p.talking ? "🔊" : "●"}
                </span>
                <span className="min-w-0 flex-1 truncate text-white/85">{p.name}</span>
                <button
                  onClick={() => onDm("/messages")}
                  className="rounded-lg border border-white/20 px-2.5 py-1 text-[12px] text-white/75 hover:bg-white/10"
                >
                  💬
                </button>
              </div>
            ))
          ))}

        {tab === "alerts" &&
          (alerts === null ? (
            <Loading />
          ) : alerts.length === 0 ? (
            <Empty text="အသိပေးချက် မရှိသေးပါ" />
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-2.5 ${
                  a.read_at
                    ? "border-white/10 bg-white/5"
                    : "border-emerald-400/30 bg-emerald-500/10"
                }`}
              >
                <p className="text-white/85">
                  <b className="text-emerald-300">{nameOf(a.actor)}</b>{" "}
                  {ALERT_MY[a.type ?? ""] ?? "အသိပေးချက်"}
                </p>
                <p className="text-[11px] text-white/40">{agoMy(a.created_at)}</p>
              </div>
            ))
          ))}

        {tab === "dm" &&
          (convos === null ? (
            <Loading />
          ) : convos.length === 0 ? (
            <Empty text="စကားဝိုင်း မရှိသေးပါ" />
          ) : (
            convos.map((c) => {
              const other = c.participants?.[0]?.profile;
              return (
                <button
                  key={c.id}
                  onClick={() => onDm(`/messages?c=${c.id}`)}
                  className={`w-full rounded-xl border p-2.5 text-left ${
                    c.unread
                      ? "border-emerald-400/30 bg-emerald-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className="flex justify-between text-[12px]">
                    <b className="text-emerald-300">{nameOf(other)}</b>
                    {c.last_message && (
                      <span className="text-white/40">{agoMy(c.last_message.created_at)}</span>
                    )}
                  </p>
                  <p className="truncate text-white/75">
                    {c.last_message?.content || "…"}
                  </p>
                </button>
              );
            })
          ))}
      </div>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={() => onDm(tab === "dm" ? "/messages" : "/feed")}
          className="w-full rounded-xl border border-white/20 py-2 text-[12px] text-white/70 hover:bg-white/5"
        >
          ↗ အပြည့်အစုံ ဖွင့်မယ်
        </button>
      </div>
    </div>
  );
}

const Loading = () => <p className="py-6 text-center text-white/40">ဆွဲနေသည်…</p>;
const Empty = ({ text }: { text: string }) => (
  <p className="py-6 text-center text-white/40">{text}</p>
);
