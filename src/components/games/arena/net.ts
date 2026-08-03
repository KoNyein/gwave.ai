/// Arena WebSocket client — ပွဲစဉ် protocol (`g*` message များ) သီးသန့်。
///
/// ★ Metaverse ရဲ့ `net.ts` ကို မတိုးချဲ့ဘဲ သီးသန့် ရေးထားတာက —
///   အဲဒါက ကမ္ဘာလှည့်ခြင်း (chat, emote, ယာဉ်, voice) အတွက် ဖြစ်ပြီး
///   ရှိပြီးသား handler ၂၀ ကျော် ရှိတယ်။ ပွဲစဉ် message တွေကို အဲဒီထဲ
///   ထပ်ထည့်ရင် live ဖြစ်နေတဲ့ metaverse client ကို ထိတယ် — ပွဲစဉ်
///   feature တစ်ခုကြောင့် ကမ္ဘာလှည့်ခြင်း ပျက်စေလို့ မဖြစ်ဘူး။
///
/// ★ နေရာကို `update` နဲ့ပဲ ပို့တယ် — metaverse နဲ့ တစ်ခုတည်း။ ဒါမှ
///   server ရဲ့ anti-cheat (speed cap, world bounds) က ပွဲစဉ်မှာလည်း
///   အလုပ်လုပ်တယ်။ ပွဲစဉ်အတွက် သီးသန့် လမ်းကြောင်း ဖောက်လိုက်ရင်
///   အဲဒီ ကာကွယ်မှုတွေ ကျော်သွားမယ်။

export type ArenaSnapshotPlayer = {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  st?: number;
};

export type ArenaState = {
  state: "waiting" | "countdown" | "live" | "ended";
  mode?: string;
  minPlayers?: number;
  endsAt?: number | null;
  countdownEndsAt?: number | null;
  reason?: string;
  result?: {
    reason: string;
    winnerId: string | null;
    scores: Array<{ id: string; name: string; score: number }>;
  } | null;
  players?: Array<{ id: string; name: string; score: number }>;
  modeState?: { seekerId?: string; blindUntil?: number };
};

export type ArenaEvent = {
  kind: string;
  id?: string;
  by?: string;
  role?: string;
  score?: number;
  until?: number;
  reason?: string;
};

export type ArenaHandlers = {
  onOpen?: () => void;
  onStatus?: (connected: boolean, detail?: string) => void;
  onJoined?: (p: { role: "player" | "spectator"; state: string }) => void;
  onDenied?: (reason: string, until: number | null) => void;
  onState?: (s: ArenaState) => void;
  onEvent?: (e: ArenaEvent) => void;
  /// ★ Snapshot က delta — ပါလာတဲ့သူတွေပဲ ပြောင်းတယ်၊ `gone` က ဖယ်ရမယ့်သူ။
  onSnapshot?: (p: {
    t: number;
    ackSeq: number;
    players: ArenaSnapshotPlayer[];
    gone?: string[];
  }) => void;
  onLeft?: (ids: string[]) => void;
  /// Server က anti-cheat နဲ့ ငြင်းလိုက်တယ် — နေရာအမှန်ကို ပြန်ပေးတယ်
  onCorrect?: (x: number, y: number, z: number) => void;
  onSelf?: (id: string) => void;
};

export type ArenaClient = {
  readonly connected: boolean;
  readonly selfId: string | null;
  sendUpdate(x: number, y: number, z: number, ry: number): void;
  sendInput(seq: number): void;
  sendAction(action: Record<string, unknown>): void;
  leaveMatch(): void;
  close(): void;
};

/// ★ နေရာပို့တဲ့ နှုန်း — server tick က ၂၀Hz မို့ ဒီထက်မြန်စွာ ပို့တာက
///   အလကား။ ၁၅Hz က metaverse နဲ့ တစ်သားတည်း ဖြစ်ပြီး ဖုန်း data လည်း
///   ချွေတယ်။
const SEND_HZ = 15;
const SEND_GAP_MS = 1000 / SEND_HZ;

const MAX_BACKOFF_MS = 15_000;

export function connectArena(
  urls: string[],
  room: string,
  handlers: ArenaHandlers,
): ArenaClient {
  const candidates = urls.filter(Boolean);
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let selfId: string | null = null;

  let lastSentAt = 0;
  const lastSent = { x: NaN, y: NaN, z: NaN, ry: NaN };

  function open() {
    if (closed || candidates.length === 0) return;
    const url = candidates[attempt % candidates.length]!;
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${url}?room=${encodeURIComponent(room)}`);
    } catch {
      retry();
      return;
    }
    ws = sock;

    sock.onopen = () => {
      attempt = 0;
      handlers.onStatus?.(true);
      handlers.onOpen?.();
      // ★ ချိတ်တာနဲ့ ပွဲထဲ ဝင်တယ် — reconnect ဖြစ်တဲ့အခါလည်း ဒါက
      //   အလိုအလျောက် ပြန်ဝင်ပေးတယ် (grace period အတွင်းဆို အမှတ်
      //   ကျန်နေမယ်)。
      sock.send(JSON.stringify({ type: "gJoin" }));
    };

    sock.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      route(msg);
    };

    sock.onclose = () => {
      handlers.onStatus?.(false, "disconnected");
      retry();
    };
    sock.onerror = () => {
      // onclose က နောက်ကနေ လာမယ် — ဒီမှာ ဘာမှ မလုပ်ဘူး
    };
  }

  function route(msg: Record<string, unknown>) {
    switch (msg.type) {
      case "init":
        // Metaverse ရဲ့ init — ကိုယ့် id ကို ဒီကနေ သိရတယ်
        selfId = String(msg.id ?? "");
        handlers.onSelf?.(selfId);
        break;
      case "gJoined":
        handlers.onJoined?.({
          role: msg.role === "spectator" ? "spectator" : "player",
          state: String(msg.state ?? "waiting"),
        });
        break;
      case "gDenied":
        handlers.onDenied?.(String(msg.reason ?? "denied"), (msg.until as number) ?? null);
        break;
      case "gState":
        handlers.onState?.(msg as unknown as ArenaState);
        break;
      case "gEvent":
        handlers.onEvent?.(msg as unknown as ArenaEvent);
        break;
      case "gLeft":
        handlers.onLeft?.((msg.ids as string[]) ?? []);
        break;
      case "snapshot":
        handlers.onSnapshot?.({
          t: Number(msg.t) || 0,
          ackSeq: Number(msg.ackSeq) || 0,
          players: (msg.players as ArenaSnapshotPlayer[]) ?? [],
          gone: msg.gone as string[] | undefined,
        });
        break;
      case "correct":
        handlers.onCorrect?.(Number(msg.x), Number(msg.y), Number(msg.z));
        break;
      default:
        break;
    }
  }

  function retry() {
    if (closed || retryTimer) return;
    attempt++;
    // ★ Exponential backoff — server ကျနေတဲ့အခါ client ၅၀၀ က
    //   စက္ကန့်တိုင်း ပြန်ချိတ်ရင် ပြန်တက်တာနဲ့ ချက်ချင်း ပြန်ကျမယ်။
    const wait = Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(attempt, 5));
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, wait);
  }

  open();

  return {
    get connected() {
      return ws?.readyState === WebSocket.OPEN;
    },
    get selfId() {
      return selfId;
    },
    sendUpdate(x, y, z, ry) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (now - lastSentAt < SEND_GAP_MS) return;
      // ငြိမ်နေရင် မပို့
      if (
        Math.abs(x - lastSent.x) < 0.01 &&
        Math.abs(y - lastSent.y) < 0.01 &&
        Math.abs(z - lastSent.z) < 0.01 &&
        Math.abs(ry - lastSent.ry) < 0.01
      ) {
        return;
      }
      lastSentAt = now;
      lastSent.x = x;
      lastSent.y = y;
      lastSent.z = z;
      lastSent.ry = ry;
      ws.send(JSON.stringify({ type: "update", x, y, z, ry }));
    },
    sendInput(seq) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      // ★ Payload က `seq` ပဲ — နေရာက `update` ကနေ သွားပြီးသား။ ဒါက
      //   client ရဲ့ input နံပါတ်ကို server က ack ပြန်လုပ်နိုင်ဖို့ပဲ။
      ws.send(JSON.stringify({ type: "gInput", seq }));
    },
    sendAction(action) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "gAction", action }));
    },
    leaveMatch() {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "gLeave" }));
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      ws?.close();
      ws = null;
    },
  };
}
