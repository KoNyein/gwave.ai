/// နေ့စဉ် Quest engine — Edu Arcade / FPV / Metaverse တစ်လျှောက် တူညီတဲ့
/// mission တွေ။
///
/// ★ Offline-first — progress က localStorage မှာ အမြဲ ရှိတယ်။ Signed-in
///   ဖြစ်ရင် `/api/games/progress` (game="quests") ကို debounce sync
///   လုပ်လို့ device ပြောင်းလည်း ဆက်တိုက် မြင်ရတယ်။
/// ★ Reward က ⭐ (cosmetic) သာ — ငွေကြေး မပါဘူး။
/// ★ နေ့ပြောင်းရင် အလိုအလျောက် reset (ရက်စွဲ key နဲ့ သိမ်းတယ်)။

export type QuestDef = {
  id: string;
  emoji: string;
  nameMy: string;
  target: number;
  /// ပြီးရင် ရမယ့် ⭐
  stars: number;
};

export const DAILY_QUESTS: QuestDef[] = [
  { id: "arcade_play", emoji: "🎓", nameMy: "Edu Arcade ဂိမ်း ၃ ခါ ကစားပါ", target: 3, stars: 2 },
  { id: "arcade_stars", emoji: "⭐", nameMy: "Arcade မှာ ရမှတ် ၁၅ မှတ် စုပါ", target: 15, stars: 3 },
  { id: "fpv_fly", emoji: "🛸", nameMy: "FPV drone ၁ ခါ ပျံသန်းပါ", target: 1, stars: 2 },
  { id: "mv_visit", emoji: "🌍", nameMy: "Metaverse လောကထဲ ဝင်ပါ", target: 1, stars: 1 },
];

type QuestState = { date: string; counts: Record<string, number>; claimed: string[] };

const KEY = "gw-quests";
const today = () => new Date().toISOString().slice(0, 10);

function load(): QuestState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<QuestState>;
      if (s.date === today()) {
        return { date: s.date, counts: s.counts ?? {}, claimed: s.claimed ?? [] };
      }
    }
  } catch {
    /* fresh */
  }
  return { date: today(), counts: {}, claimed: [] };
}

function save(s: QuestState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/// Server နဲ့ merge — count တွေက max ယူတယ် (device နှစ်ခုက counter မတူရင်
/// များတဲ့ဘက် နိုင်တယ်၊ နှစ်ခါမပေါင်းဘူး — quest က မလိမ်နိုင်အောင်)။
async function pull(): Promise<void> {
  try {
    const res = await fetch("/api/games/progress", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as {
      progress?: Record<string, { data?: { date?: string; counts?: Record<string, number>; claimed?: string[] } }>;
    };
    const remote = j.progress?.quests?.data;
    if (!remote || remote.date !== today()) return;
    const s = load();
    for (const [k, v] of Object.entries(remote.counts ?? {})) {
      s.counts[k] = Math.max(s.counts[k] ?? 0, Number(v) || 0);
    }
    s.claimed = [...new Set([...s.claimed, ...(remote.claimed ?? [])])];
    save(s);
  } catch {
    /* offline — local ဆက်သုံး */
  }
}

function push() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const s = load();
    void fetch("/api/games/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "quests", data: s }),
    }).catch(() => null);
  }, 1500);
}

/// Game code တွေက ဒါကိုပဲ ခေါ်တယ် — event မှတ်ပြီး sync။
export function questEvent(id: string, n = 1) {
  if (typeof window === "undefined") return;
  const s = load();
  s.counts[id] = (s.counts[id] ?? 0) + n;
  save(s);
  push();
}

export type QuestView = QuestDef & { progress: number; done: boolean };

export function questsToday(): QuestView[] {
  if (typeof window === "undefined") {
    return DAILY_QUESTS.map((q) => ({ ...q, progress: 0, done: false }));
  }
  const s = load();
  return DAILY_QUESTS.map((q) => {
    const p = Math.min(q.target, s.counts[q.id] ?? 0);
    return { ...q, progress: p, done: p >= q.target };
  });
}

/// Panel ဖွင့်ချိန် server ကနေ ဆွဲ merge — signed-in မဟုတ်ရင် သက်ရောက်မှုမရှိ
export async function refreshQuests(): Promise<QuestView[]> {
  await pull();
  return questsToday();
}

/// Best score sync (arcade/fpv) — localStorage ရော server ရော
export function syncBest(game: string, best: number, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  void fetch("/api/games/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ game, best, data }),
  }).catch(() => null);
}

export async function fetchBests(): Promise<Record<string, { best: number; data: Record<string, unknown> }>> {
  try {
    const res = await fetch("/api/games/progress", { cache: "no-store" });
    if (!res.ok) return {};
    const j = (await res.json()) as { progress?: Record<string, { best: number; data: Record<string, unknown> }> };
    return j.progress ?? {};
  } catch {
    return {};
  }
}
